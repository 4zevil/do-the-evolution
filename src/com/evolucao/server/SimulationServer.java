package com.evolucao.server;

import com.evolucao.engine.SimulationEngine;
import com.evolucao.model.*;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/**
 * Servidor HTTP + WebSocket (RFC 6455) em Java SE puro (sem dependências externas).
 * Fornece:
 * - Arquivos estáticos de web/
 * - Streaming por tick via WebSocket (/ws) em modo delta ou snapshot
 * - Endpoints REST (/api/state, /api/grid, /api/entity?id=..., /api/tick, /api/control)
 */
public class SimulationServer {
    private static final int PORT = 8080;
    private static final String WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private static final int MAX_WS_PAYLOAD_BYTES = 1_048_576;
    private static final int WS_QUEUE_CAPACITY = 32;
    private static final long BASE_TICK_INTERVAL_MS = 50L; // 20 ticks/s base em 1x
    private static final String RESYNC_SENTINEL = "__RESYNC__";

    private SimulationEngine engine;
    private final Object engineLock = new Object();

    private final Path webRoot;
    private final Set<WebSocketClient> wsClients = ConcurrentHashMap.newKeySet();
    private final Map<String, EntityCache> broadcastCache = new HashMap<>();
    private final Set<String> knownSpeciesIds = new HashSet<>();

    private final ExecutorService connectionPool = Executors.newCachedThreadPool();
    private final ScheduledExecutorService loopScheduler = Executors.newSingleThreadScheduledExecutor();

    private volatile boolean running = false;
    private volatile int speed = 1;
    private volatile long lastLoopTickMs = 0L;

    public SimulationServer() {
        Path candidate = Paths.get("web").toAbsolutePath().normalize();
        this.webRoot = Files.isDirectory(candidate)
            ? candidate
            : Paths.get(".").toAbsolutePath().normalize();
        initDemoWorld(System.currentTimeMillis());
    }

    private void initDemoWorld(long seed) {
        synchronized (engineLock) {
            this.engine = new SimulationEngine(24, 32, "random", seed);
            populateInitialEcosystem();
            rebuildBroadcastCacheLocked();
        }
    }

    private void populateInitialEcosystem() {
        int rows = engine.getRows();
        int cols = engine.getCols();
        GridCell[][] grid = engine.getGrid();
        double cellSize = engine.getCellSize();

        // 1. Popula plantas em células habitáveis
        int spawnedPlants = 0;
        for (int attempt = 0; attempt < 240 && spawnedPlants < 42; attempt++) {
            int r = (int) (Math.random() * rows);
            int c = (int) (Math.random() * cols);
            GridCell cell = grid[r][c];
            if (!cell.isHabitable() || cell.getPlant() != null) continue;

            boolean isShrub = (spawnedPlants % 4 == 0);
            Plant plant = new Plant(
                "p" + spawnedPlants,
                isShrub ? "Arbusto Espinhoso" : "Capim Silvestre",
                isShrub ? "sp_shrub" : "sp_grass",
                r, c,
                isShrub ? 0.65 : 0.30,
                isShrub ? 0.55 : 0.75,
                isShrub ? 0.45 : 0.85,
                isShrub ? 0.50 : 0.08,
                isShrub ? 0.65 : 0.25,
                0.50,
                0.0,
                isShrub ? 140.0 : 112.0
            );
            plant.setGrowth(0.35 + Math.random() * 0.40);
            engine.addPlant(plant);
            spawnedPlants++;
        }

        // 2. Popula herbívoros e predadores adultos em células habitáveis
        int spawnedAnimals = 0;
        for (int attempt = 0; attempt < 150 && spawnedAnimals < 24; attempt++) {
            int r = (int) (Math.random() * rows);
            int c = (int) (Math.random() * cols);
            if (!grid[r][c].isHabitable()) continue;

            boolean isPred = (spawnedAnimals % 5 == 0);
            double px = (c + 0.5) * cellSize;
            double py = (r + 0.5) * cellSize;

            Animal animal = new Animal(
                "a" + spawnedAnimals,
                isPred ? "Lobo" : "Lebre",
                isPred ? "Lobo" : "Lebre",
                isPred ? "sp_wolf" : "sp_rabbit",
                px, py,
                isPred ? 0.68 : 0.35,
                isPred ? 0.85 : 0.02,
                isPred ? 0.05 : 0.90,
                isPred ? 0.78 : 0.70,
                isPred ? 0.82 : 0.65,
                isPred ? 0.45 : 0.25,
                isPred ? 0.35 : 0.75,
                isPred ? 0.75 : 0.12,
                isPred ? 0.65 : 0.50,
                isPred ? 0.18 : 0.08,
                0.0,
                isPred ? 25.0 : 95.0
            );
            animal.setAge(180 + (int) (Math.random() * 140));
            engine.addAnimal(animal);
            spawnedAnimals++;
        }
    }

    public void start() throws IOException {
        start(false);
    }

    public void start(boolean autoStart) throws IOException {
        this.running = autoStart;
        startLoopScheduler();

        ServerSocket serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress(PORT));

        System.out.println("==========================================================");
        System.out.println("  SIMULADOR DE EVOLUÇÃO — JAVA SE ENGINE + WEBSOCKET      ");
        System.out.println("  HTTP / Web:   http://localhost:" + PORT + "                 ");
        System.out.println("  WebSocket:    ws://localhost:" + PORT + "/ws               ");
        System.out.println("  REST State:   http://localhost:" + PORT + "/api/state      ");
        System.out.println("  REST Inspect: http://localhost:" + PORT + "/api/entity?id= ");
        System.out.println("==========================================================");

        Thread acceptThread = new Thread(() -> {
            while (!serverSocket.isClosed()) {
                try {
                    Socket socket = serverSocket.accept();
                    connectionPool.submit(() -> handleConnection(socket));
                } catch (IOException e) {
                    if (!serverSocket.isClosed()) {
                        System.err.println("[SERVER] Erro no accept(): " + e.getMessage());
                    }
                }
            }
        }, "evosim-http-ws-acceptor");
        acceptThread.start();
    }

    private void startLoopScheduler() {
        loopScheduler.scheduleAtFixedRate(() -> {
            try {
                if (!running) return;
                long now = System.currentTimeMillis();
                long stepInterval = Math.max(16L, BASE_TICK_INTERVAL_MS / Math.max(1, speed));
                if (now - lastLoopTickMs < stepInterval) return;
                lastLoopTickMs = now;

                String deltaJson;
                synchronized (engineLock) {
                    engine.updateTick();
                    deltaJson = wsClients.isEmpty() ? null : buildDeltaJsonLocked();
                }
                if (deltaJson != null) {
                    broadcastDelta(deltaJson);
                }
            } catch (Exception ex) {
                System.err.println("[LOOP] Erro no tick: " + ex.getMessage());
            }
        }, 16L, 16L, TimeUnit.MILLISECONDS);
    }

    private void handleConnection(Socket socket) {
        try {
            socket.setSoTimeout(15000);
            BufferedInputStream in = new BufferedInputStream(socket.getInputStream(), 8192);
            OutputStream out = socket.getOutputStream();

            String headerBlock = readHttpHeaderBlock(in);
            if (headerBlock == null || headerBlock.isEmpty()) {
                socket.close();
                return;
            }

            String[] lines = headerBlock.split("\r\n");
            if (lines.length == 0) {
                socket.close();
                return;
            }

            String[] reqParts = lines[0].split(" ");
            if (reqParts.length < 2) {
                sendHttpError(out, 400, "Bad Request");
                socket.close();
                return;
            }

            String method = reqParts[0].toUpperCase(Locale.ROOT);
            String rawTarget = reqParts[1];
            Map<String, String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon > 0) {
                    String k = lines[i].substring(0, colon).trim().toLowerCase(Locale.ROOT);
                    String v = lines[i].substring(colon + 1).trim();
                    headers.put(k, v);
                }
            }

            // Verifica Upgrade para WebSocket RFC 6455
            String upgrade = headers.get("upgrade");
            String wsKey = headers.get("sec-websocket-key");
            if ("GET".equals(method) && "websocket".equalsIgnoreCase(upgrade) && wsKey != null && !wsKey.isEmpty()) {
                handleWebSocketHandshakeAndSession(socket, in, out, wsKey);
                return;
            }

            // Lê corpo caso haja Content-Length
            int contentLength = 0;
            String clStr = headers.get("content-length");
            if (clStr != null) {
                try {
                    contentLength = Math.max(0, Math.min(262_144, Integer.parseInt(clStr)));
                } catch (NumberFormatException ignored) {
                    contentLength = 0;
                }
            }
            String body = "";
            if (contentLength > 0) {
                byte[] bodyBytes = new byte[contentLength];
                readFully(in, bodyBytes, 0, contentLength);
                body = new String(bodyBytes, StandardCharsets.UTF_8);
            }

            routeHttpRequest(method, rawTarget, body, out);
            socket.close();
        } catch (IOException ignored) {
            try { socket.close(); } catch (IOException ignored2) {}
        }
    }

    private void routeHttpRequest(String method, String rawTarget, String body, OutputStream out) throws IOException {
        if ("OPTIONS".equals(method)) {
            sendHttpResponse(out, 204, "text/plain; charset=UTF-8", new byte[0]);
            return;
        }

        int qIdx = rawTarget.indexOf('?');
        String path = qIdx >= 0 ? rawTarget.substring(0, qIdx) : rawTarget;
        String query = qIdx >= 0 ? rawTarget.substring(qIdx + 1) : "";
        Map<String, String> queryParams = parseQueryParams(query);

        if ("/api/state".equals(path)) {
            String json;
            synchronized (engineLock) {
                json = buildSnapshotJsonLocked();
            }
            sendJsonResponse(out, 200, json);
            return;
        }

        if ("/api/grid".equals(path)) {
            String json;
            synchronized (engineLock) {
                json = buildGridJsonLocked();
            }
            sendJsonResponse(out, 200, json);
            return;
        }

        if ("/api/entity".equals(path) || path.startsWith("/api/entity/")) {
            String id = queryParams.get("id");
            if ((id == null || id.isEmpty()) && path.startsWith("/api/entity/")) {
                id = URLDecoder.decode(path.substring("/api/entity/".length()), StandardCharsets.UTF_8);
            }
            if (id == null || id.isEmpty()) {
                sendJsonResponse(out, 400, "{\"error\":\"Missing entity id\"}");
                return;
            }
            String detailJson;
            synchronized (engineLock) {
                detailJson = buildEntityDetailJsonLocked(id);
            }
            if (detailJson == null) {
                sendJsonResponse(out, 404, "{\"error\":\"Entity not found\",\"id\":\"" + escapeJson(id) + "\"}");
            } else {
                sendJsonResponse(out, 200, detailJson);
            }
            return;
        }

        if ("/api/tick".equals(path)) {
            String deltaJson;
            synchronized (engineLock) {
                engine.updateTick();
                deltaJson = buildDeltaJsonLocked();
            }
            broadcastDelta(deltaJson);
            sendJsonResponse(out, 200, deltaJson);
            return;
        }

        if ("/api/control".equals(path)) {
            Map<String, String> merged = new HashMap<>(queryParams);
            if (body != null && !body.isEmpty()) {
                merged.putAll(parseSimpleJsonObject(body));
            }
            String action = merged.getOrDefault("action", merged.getOrDefault("op", ""));
            String result = applyControlAction(action, merged);
            sendJsonResponse(out, 200, result);
            return;
        }

        // Arquivos estáticos de web/
        serveStaticFile(path, out);
    }

    private String applyControlAction(String action, Map<String, String> params) {
        String act = action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
        switch (act) {
            case "play":
                running = true;
                lastLoopTickMs = 0L;
                return buildControlAckJson("play");
            case "pause":
                running = false;
                return buildControlAckJson("pause");
            case "speed": {
                int v = parseIntSafe(params.get("value"), speed);
                speed = Math.max(1, Math.min(20, v));
                return buildControlAckJson("speed");
            }
            case "reset": {
                String snapshot;
                synchronized (engineLock) {
                    initDemoWorld(System.currentTimeMillis());
                    snapshot = buildSnapshotJsonLocked();
                }
                broadcastRaw(snapshot);
                return snapshot;
            }
            case "meteor": {
                double mx = parseDoubleSafe(params.get("x"), Double.NaN);
                double my = parseDoubleSafe(params.get("y"), Double.NaN);
                String delta;
                synchronized (engineLock) {
                    engine.triggerMeteor(mx, my);
                    delta = buildDeltaJsonLocked();
                }
                broadcastDelta(delta);
                return delta;
            }
            case "climate": {
                boolean isReset = "true".equalsIgnoreCase(params.get("reset"));
                double deltaTemp = parseDoubleSafe(params.get("delta"), 0.0);
                String delta;
                synchronized (engineLock) {
                    if (isReset) engine.resetClimate();
                    else engine.shiftClimate(deltaTemp);
                    delta = buildDeltaJsonLocked();
                }
                broadcastDelta(delta);
                return delta;
            }
            default:
                return "{\"ok\":false,\"error\":\"Unknown action\"}";
        }
    }

    private String buildControlAckJson(String action) {
        synchronized (engineLock) {
            return "{\"op\":\"controlAck\",\"ok\":true,\"action\":\"" + escapeJson(action)
                + "\",\"running\":" + running
                + ",\"speed\":" + speed
                + ",\"tick\":" + engine.getTotalTicks() + "}";
        }
    }

    // ════════════════════════════════════════════════════
    // WEBSOCKET RFC 6455 (JAVA SE PURO)
    // ════════════════════════════════════════════════════

    private void handleWebSocketHandshakeAndSession(Socket socket, BufferedInputStream in, OutputStream out, String wsKey)
            throws IOException {
        String acceptKey;
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] hash = sha1.digest((wsKey.trim() + WS_MAGIC).getBytes(StandardCharsets.UTF_8));
            acceptKey = Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            sendHttpError(out, 500, "WebSocket handshake error");
            socket.close();
            return;
        }

        String response = "HTTP/1.1 101 Switching Protocols\r\n"
            + "Upgrade: websocket\r\n"
            + "Connection: Upgrade\r\n"
            + "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";
        out.write(response.getBytes(StandardCharsets.UTF_8));
        out.flush();

        socket.setSoTimeout(0);
        socket.setTcpNoDelay(true);

        WebSocketClient client = new WebSocketClient(socket, out);
        synchronized (engineLock) {
            String initialSnapshot = buildSnapshotJsonLocked();
            client.enqueueControlOrSnapshot(initialSnapshot);
            wsClients.add(client);
        }

        // Thread dedicada de envio assíncrono para nunca travar o loop de simulação
        connectionPool.submit(() -> client.writerLoop());

        try {
            client.readerLoop(in);
        } finally {
            wsClients.remove(client);
            client.close();
        }
    }

    private void broadcastDelta(String deltaJson) {
        if (deltaJson == null || wsClients.isEmpty()) return;
        for (WebSocketClient client : wsClients) {
            client.enqueueDelta(deltaJson);
        }
    }

    private void broadcastRaw(String json) {
        if (json == null || wsClients.isEmpty()) return;
        for (WebSocketClient client : wsClients) {
            client.enqueueControlOrSnapshot(json);
        }
    }

    private void handleWsClientMessage(WebSocketClient client, String rawMsg) {
        Map<String, String> msg = parseSimpleJsonObject(rawMsg);
        String op = msg.getOrDefault("op", msg.getOrDefault("type", msg.getOrDefault("action", ""))).toLowerCase(Locale.ROOT);

        switch (op) {
            case "ping": {
                int tick;
                synchronized (engineLock) {
                    tick = engine.getTotalTicks();
                }
                client.sendImmediate("{\"op\":\"pong\",\"tick\":" + tick + "}");
                break;
            }
            case "sync": {
                String snapshot;
                synchronized (engineLock) {
                    snapshot = buildSnapshotJsonLocked();
                }
                client.sendImmediate(snapshot);
                break;
            }
            case "grid": {
                String gridJson;
                synchronized (engineLock) {
                    gridJson = buildGridJsonLocked();
                }
                client.sendImmediate(gridJson);
                break;
            }
            case "inspect": {
                String id = msg.get("id");
                String envelope;
                synchronized (engineLock) {
                    String detail = buildEntityDetailJsonLocked(id);
                    if (detail != null) {
                        envelope = "{\"op\":\"entityDetail\",\"id\":\"" + escapeJson(id) + "\",\"found\":true,\"entity\":" + detail + "}";
                    } else {
                        envelope = "{\"op\":\"entityDetail\",\"id\":\"" + escapeJson(id != null ? id : "") + "\",\"found\":false}";
                    }
                }
                client.sendImmediate(envelope);
                break;
            }
            case "tick": {
                String delta;
                synchronized (engineLock) {
                    engine.updateTick();
                    delta = buildDeltaJsonLocked();
                }
                broadcastDelta(delta);
                break;
            }
            case "play":
            case "pause":
            case "speed":
            case "reset":
            case "meteor":
            case "climate": {
                String res = applyControlAction(op, msg);
                if ("play".equals(op) || "pause".equals(op) || "speed".equals(op)) {
                    client.sendImmediate(res);
                }
                break;
            }
            default:
                client.sendImmediate("{\"op\":\"error\",\"message\":\"Unsupported op: " + escapeJson(op) + "\"}");
                break;
        }
    }

    private final class WebSocketClient {
        private final Socket socket;
        private final OutputStream out;
        private final Object outLock = new Object();
        private final BlockingQueue<String> outbound = new LinkedBlockingQueue<>(WS_QUEUE_CAPACITY);
        private volatile boolean open = true;
        private volatile boolean needsResync = false;

        WebSocketClient(Socket socket, OutputStream out) {
            this.socket = socket;
            this.out = out;
        }

        void enqueueDelta(String json) {
            if (!open || needsResync) return;
            if (!outbound.offer(json)) {
                needsResync = true;
                outbound.clear();
                outbound.offer(RESYNC_SENTINEL);
            }
        }

        void enqueueControlOrSnapshot(String json) {
            if (!open) return;
            outbound.clear();
            needsResync = false;
            outbound.offer(json);
        }

        void sendImmediate(String json) {
            if (!open) return;
            try {
                sendFrame(0x81, json.getBytes(StandardCharsets.UTF_8));
            } catch (IOException e) {
                close();
            }
        }

        void writerLoop() {
            try {
                while (open) {
                    String next = outbound.take();
                    if (!open) break;
                    if (RESYNC_SENTINEL.equals(next)) {
                        String freshSnapshot;
                        synchronized (engineLock) {
                            freshSnapshot = buildSnapshotJsonLocked();
                            needsResync = false;
                        }
                        sendFrame(0x81, freshSnapshot.getBytes(StandardCharsets.UTF_8));
                    } else {
                        sendFrame(0x81, next.getBytes(StandardCharsets.UTF_8));
                    }
                }
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                close();
            }
        }

        void readerLoop(BufferedInputStream in) throws IOException {
            ByteArrayOutputStream fragBuf = null;
            while (open && !socket.isClosed()) {
                int b0 = in.read();
                if (b0 == -1) break;
                int b1 = in.read();
                if (b1 == -1) break;

                boolean fin = (b0 & 0x80) != 0;
                int opcode = b0 & 0x0F;
                boolean masked = (b1 & 0x80) != 0;
                long payloadLen = b1 & 0x7F;

                if (payloadLen == 126) {
                    byte[] ext = new byte[2];
                    readFully(in, ext, 0, 2);
                    payloadLen = ((ext[0] & 0xFFL) << 8) | (ext[1] & 0xFFL);
                } else if (payloadLen == 127) {
                    byte[] ext = new byte[8];
                    readFully(in, ext, 0, 8);
                    payloadLen = 0;
                    for (int i = 0; i < 8; i++) {
                        payloadLen = (payloadLen << 8) | (ext[i] & 0xFFL);
                    }
                }

                if (payloadLen < 0 || payloadLen > MAX_WS_PAYLOAD_BYTES) {
                    sendFrame(0x88, new byte[]{0x03, (byte) 0xF1}); // 1009 Too Big
                    break;
                }

                byte[] mask = null;
                if (masked) {
                    mask = new byte[4];
                    readFully(in, mask, 0, 4);
                }

                byte[] payload = new byte[(int) payloadLen];
                if (payloadLen > 0) {
                    readFully(in, payload, 0, (int) payloadLen);
                    if (masked) {
                        for (int i = 0; i < payload.length; i++) {
                            payload[i] = (byte) (payload[i] ^ mask[i % 4]);
                        }
                    }
                }

                if (opcode == 0x8) {
                    sendFrame(0x88, new byte[0]);
                    break;
                } else if (opcode == 0x9) {
                    sendFrame(0x8A, payload); // Pong
                    continue;
                } else if (opcode == 0xA) {
                    continue;
                }

                if (opcode == 0x1 || opcode == 0x0) {
                    if (opcode == 0x1 && fin && fragBuf == null) {
                        handleWsClientMessage(this, new String(payload, StandardCharsets.UTF_8));
                    } else {
                        if (opcode == 0x1) fragBuf = new ByteArrayOutputStream();
                        if (fragBuf != null) {
                            fragBuf.write(payload);
                            if (fragBuf.size() > MAX_WS_PAYLOAD_BYTES) {
                                sendFrame(0x88, new byte[]{0x03, (byte) 0xF1});
                                break;
                            }
                            if (fin) {
                                String text = fragBuf.toString(StandardCharsets.UTF_8);
                                fragBuf = null;
                                handleWsClientMessage(this, text);
                            }
                        }
                    }
                }
            }
        }

        private void sendFrame(int firstByte, byte[] payload) throws IOException {
            int len = payload.length;
            ByteArrayOutputStream frame = new ByteArrayOutputStream(len + 10);
            frame.write(firstByte);
            if (len <= 125) {
                frame.write(len);
            } else if (len <= 65535) {
                frame.write(126);
                frame.write((len >>> 8) & 0xFF);
                frame.write(len & 0xFF);
            } else {
                frame.write(127);
                long l = len;
                for (int shift = 56; shift >= 0; shift -= 8) {
                    frame.write((int) ((l >>> shift) & 0xFFL));
                }
            }
            frame.write(payload);
            synchronized (outLock) {
                if (!open) return;
                out.write(frame.toByteArray());
                out.flush();
            }
        }

        void close() {
            if (!open) return;
            open = false;
            outbound.clear();
            try { socket.close(); } catch (IOException ignored) {}
        }
    }

    // ════════════════════════════════════════════════════
    // PROTOCOLO DE STREAMING JSON (SNAPSHOT, DELTA E INSPETOR)
    // ════════════════════════════════════════════════════

    private static final class EntityCache {
        String id;
        String type;
        String speciesId;
        double x, y, vx, vy;
        double size;
        int colorHue;
        double meat, plantDiet, carcassDiet;
        double aquatic, speed, health;
        String lifeStage;
        String state;
        boolean hasFruit;
        double defense;
        double energy, maxEnergy, growth, stamina, camouflageFactor;
        boolean pregnant, diseased;
        String limitingFactor;

        static EntityCache fromAnimal(Animal a) {
            EntityCache c = new EntityCache();
            c.id = a.getId();
            c.type = "animal";
            c.speciesId = a.getSpeciesId();
            c.x = round1(a.getX());
            c.y = round1(a.getY());
            c.vx = round2(a.getVx());
            c.vy = round2(a.getVy());
            c.size = round2(a.getSize());
            c.colorHue = (int) Math.round(a.getColorHue());
            c.meat = round2(a.getCarnivore());
            c.plantDiet = round2(a.getPlant());
            c.carcassDiet = round2(a.getCarcassDiet());
            c.aquatic = round2(a.getAquatic());
            c.speed = round2(a.getSpeed());
            c.health = round2(a.getHealth());
            c.lifeStage = a.getLifeStageKey();
            c.state = a.getState();
            c.energy = round1(a.getEnergy());
            c.maxEnergy = round1(a.getMaxEnergy());
            c.stamina = round1(a.getStamina());
            c.camouflageFactor = round2(a.getCamouflageFactor());
            c.pregnant = a.isPregnant();
            c.diseased = a.isDiseased();
            return c;
        }

        static EntityCache fromPlant(Plant p) {
            EntityCache c = new EntityCache();
            c.id = p.getId();
            c.type = "plant";
            c.speciesId = p.getSpeciesId();
            c.x = round1(p.getX());
            c.y = round1(p.getY());
            c.size = round2(p.getHeight());
            c.growth = round2(p.getGrowth());
            c.colorHue = (int) Math.round(p.getColorHue());
            c.hasFruit = p.hasFruit();
            c.defense = round2(p.getDefense());
            c.state = p.getState();
            c.limitingFactor = p.getLimitingFactorKey();
            c.energy = round1(p.getEnergy());
            return c;
        }

        static EntityCache fromCarcass(Carcass k) {
            EntityCache c = new EntityCache();
            c.id = k.getId();
            c.type = "carcass";
            c.speciesId = "carcass";
            c.x = round1(k.getX());
            c.y = round1(k.getY());
            c.energy = round1(k.getRemainingEnergy());
            c.size = round2(Math.min(1.0, k.getRemainingEnergy() / 75.0));
            c.state = "decaying";
            return c;
        }

        void appendFullJson(StringBuilder sb) {
            sb.append('{');
            sb.append("\"id\":\"").append(escapeJson(id)).append('"');
            sb.append(",\"type\":\"").append(type).append('"');
            sb.append(",\"speciesId\":\"").append(escapeJson(speciesId)).append('"');
            sb.append(",\"x\":").append(fmt(x));
            sb.append(",\"y\":").append(fmt(y));
            sb.append(",\"size\":").append(fmt(size));
            sb.append(",\"state\":\"").append(escapeJson(state)).append('"');

            if ("animal".equals(type)) {
                sb.append(",\"vx\":").append(fmt(vx));
                sb.append(",\"vy\":").append(fmt(vy));
                sb.append(",\"colorHue\":").append(colorHue);
                sb.append(",\"diet\":{\"meat\":").append(fmt(meat))
                  .append(",\"plant\":").append(fmt(plantDiet))
                  .append(",\"carcass\":").append(fmt(carcassDiet)).append('}');
                sb.append(",\"aquatic\":").append(fmt(aquatic));
                sb.append(",\"speed\":").append(fmt(speed));
                sb.append(",\"health\":").append(fmt(health));
                sb.append(",\"lifeStage\":\"").append(lifeStage).append('"');
                sb.append(",\"energy\":").append(fmt(energy));
                sb.append(",\"maxEnergy\":").append(fmt(maxEnergy));
                sb.append(",\"stamina\":").append(fmt(stamina));
                sb.append(",\"camouflageFactor\":").append(fmt(camouflageFactor));
                sb.append(",\"pregnant\":").append(pregnant);
                sb.append(",\"diseased\":").append(diseased);
            } else if ("plant".equals(type)) {
                sb.append(",\"colorHue\":").append(colorHue);
                sb.append(",\"growth\":").append(fmt(growth));
                sb.append(",\"hasFruit\":").append(hasFruit);
                sb.append(",\"defense\":").append(fmt(defense));
                sb.append(",\"limitingFactor\":\"").append(limitingFactor).append('"');
            } else {
                sb.append(",\"energy\":").append(fmt(energy));
            }
            sb.append('}');
        }

        boolean appendDiffJson(EntityCache prev, StringBuilder sb) {
            StringBuilder diff = new StringBuilder();
            if (x != prev.x) diff.append(",\"x\":").append(fmt(x));
            if (y != prev.y) diff.append(",\"y\":").append(fmt(y));
            if (size != prev.size) diff.append(",\"size\":").append(fmt(size));
            if (!Objects.equals(state, prev.state)) diff.append(",\"state\":\"").append(escapeJson(state)).append('"');

            if ("animal".equals(type)) {
                if (vx != prev.vx) diff.append(",\"vx\":").append(fmt(vx));
                if (vy != prev.vy) diff.append(",\"vy\":").append(fmt(vy));
                if (!Objects.equals(lifeStage, prev.lifeStage)) diff.append(",\"lifeStage\":\"").append(lifeStage).append('"');
                if (energy != prev.energy) diff.append(",\"energy\":").append(fmt(energy));
                if (stamina != prev.stamina) diff.append(",\"stamina\":").append(fmt(stamina));
                if (camouflageFactor != prev.camouflageFactor) diff.append(",\"camouflageFactor\":").append(fmt(camouflageFactor));
                if (pregnant != prev.pregnant) diff.append(",\"pregnant\":").append(pregnant);
                if (diseased != prev.diseased) diff.append(",\"diseased\":").append(diseased);
            } else if ("plant".equals(type)) {
                if (growth != prev.growth) diff.append(",\"growth\":").append(fmt(growth));
                if (hasFruit != prev.hasFruit) diff.append(",\"hasFruit\":").append(hasFruit);
                if (!Objects.equals(limitingFactor, prev.limitingFactor)) {
                    diff.append(",\"limitingFactor\":\"").append(limitingFactor).append('"');
                }
            } else {
                if (energy != prev.energy) diff.append(",\"energy\":").append(fmt(energy));
            }

            if (diff.length() == 0) return false;
            sb.append("{\"id\":\"").append(escapeJson(id)).append("\",\"type\":\"").append(type).append('"');
            sb.append(diff);
            sb.append('}');
            return true;
        }
    }

    private void rebuildBroadcastCacheLocked() {
        broadcastCache.clear();
        knownSpeciesIds.clear();
        for (SimulationEngine.SpeciesInfo sp : engine.getSpeciesCatalog()) {
            knownSpeciesIds.add(sp.speciesId);
        }
        for (Animal a : engine.getAnimals()) {
            broadcastCache.put(a.getId(), EntityCache.fromAnimal(a));
        }
        for (Plant p : engine.getPlants()) {
            broadcastCache.put(p.getId(), EntityCache.fromPlant(p));
        }
        for (Carcass c : engine.getCarcasses()) {
            broadcastCache.put(c.getId(), EntityCache.fromCarcass(c));
        }
    }

    private void appendGlobalStateJson(StringBuilder sb) {
        Season s = engine.getCurrentSeason();
        sb.append("{");
        sb.append("\"tick\":").append(engine.getTotalTicks());
        sb.append(",\"generation\":").append(engine.getGeneration());
        sb.append(",\"season\":\"").append(escapeJson(s.getName())).append('"');
        sb.append(",\"seasonKey\":\"").append(s.name()).append('"');
        sb.append(",\"seasonIcon\":\"").append(escapeJson(s.getIcon())).append('"');
        sb.append(",\"temperature\":").append(fmt(round1(engine.getEffectiveGlobalTemperatureCelsius())));
        sb.append(",\"tempNorm\":").append(fmt(round2(engine.getEffectiveGlobalTemperature())));
        sb.append(",\"climateOffset\":").append(fmt(round2(engine.getClimateOffset())));
        sb.append(",\"impactWinterTicks\":").append(engine.getImpactWinterTicks());
        sb.append(",\"running\":").append(running);
        sb.append(",\"speed\":").append(speed);
        sb.append(",\"gridRows\":").append(engine.getRows());
        sb.append(",\"gridCols\":").append(engine.getCols());
        sb.append(",\"cellSize\":").append(fmt(engine.getCellSize()));
        sb.append(",\"counts\":{")
          .append("\"animals\":").append(engine.getAnimals().size())
          .append(",\"plants\":").append(engine.getPlants().size())
          .append(",\"carcasses\":").append(engine.getCarcasses().size())
          .append('}');
        sb.append('}');
    }

    private String buildSnapshotJsonLocked() {
        rebuildBroadcastCacheLocked();

        StringBuilder sb = new StringBuilder(8192);
        sb.append("{\"op\":\"snapshot\",\"global\":");
        appendGlobalStateJson(sb);

        sb.append(",\"species\":{");
        boolean firstSp = true;
        for (SimulationEngine.SpeciesInfo sp : engine.getSpeciesCatalog()) {
            if (!firstSp) sb.append(',');
            firstSp = false;
            appendSpeciesEntry(sb, sp);
        }
        sb.append('}');

        sb.append(",\"entities\":[");
        boolean firstEnt = true;
        for (EntityCache ec : broadcastCache.values()) {
            if (!firstEnt) sb.append(',');
            firstEnt = false;
            ec.appendFullJson(sb);
        }
        sb.append("]}");
        return sb.toString();
    }

    private String buildDeltaJsonLocked() {
        Map<String, EntityCache> current = new LinkedHashMap<>();
        for (Animal a : engine.getAnimals()) current.put(a.getId(), EntityCache.fromAnimal(a));
        for (Plant p : engine.getPlants()) current.put(p.getId(), EntityCache.fromPlant(p));
        for (Carcass c : engine.getCarcasses()) current.put(c.getId(), EntityCache.fromCarcass(c));

        StringBuilder createdSb = new StringBuilder();
        StringBuilder updatedSb = new StringBuilder();
        StringBuilder removedSb = new StringBuilder();
        boolean firstCreated = true, firstUpdated = true, firstRemoved = true;

        for (EntityCache cur : current.values()) {
            EntityCache prev = broadcastCache.get(cur.id);
            if (prev == null) {
                if (!firstCreated) createdSb.append(',');
                firstCreated = false;
                cur.appendFullJson(createdSb);
            } else {
                StringBuilder itemDiff = new StringBuilder();
                if (cur.appendDiffJson(prev, itemDiff)) {
                    if (!firstUpdated) updatedSb.append(',');
                    firstUpdated = false;
                    updatedSb.append(itemDiff);
                }
            }
        }

        for (String oldId : broadcastCache.keySet()) {
            if (!current.containsKey(oldId)) {
                if (!firstRemoved) removedSb.append(',');
                firstRemoved = false;
                removedSb.append('"').append(escapeJson(oldId)).append('"');
            }
        }

        broadcastCache.clear();
        broadcastCache.putAll(current);

        StringBuilder addedSpSb = new StringBuilder();
        boolean firstSp = true;
        for (SimulationEngine.SpeciesInfo sp : engine.getSpeciesCatalog()) {
            if (knownSpeciesIds.add(sp.speciesId)) {
                if (!firstSp) addedSpSb.append(',');
                firstSp = false;
                appendSpeciesEntry(addedSpSb, sp);
            }
        }

        List<GridCell> dirty = engine.consumeDirtyCells();
        StringBuilder cellsSb = new StringBuilder();
        for (int i = 0; i < dirty.size(); i++) {
            if (i > 0) cellsSb.append(',');
            appendCellJson(cellsSb, dirty.get(i));
        }

        StringBuilder sb = new StringBuilder(2048);
        sb.append("{\"op\":\"delta\",\"global\":");
        appendGlobalStateJson(sb);
        if (addedSpSb.length() > 0) {
            sb.append(",\"addedSpecies\":{").append(addedSpSb).append('}');
        }
        sb.append(",\"created\":[").append(createdSb).append(']');
        sb.append(",\"updated\":[").append(updatedSb).append(']');
        sb.append(",\"removed\":[").append(removedSb).append(']');
        if (cellsSb.length() > 0) {
            sb.append(",\"cells\":[").append(cellsSb).append(']');
        }
        sb.append('}');
        return sb.toString();
    }

    private String buildGridJsonLocked() {
        GridCell[][] grid = engine.getGrid();
        StringBuilder sb = new StringBuilder(engine.getRows() * engine.getCols() * 96);
        sb.append("{\"op\":\"grid\",\"rows\":").append(engine.getRows())
          .append(",\"cols\":").append(engine.getCols())
          .append(",\"cellSize\":").append(fmt(engine.getCellSize()))
          .append(",\"cells\":[");
        boolean first = true;
        for (int r = 0; r < engine.getRows(); r++) {
            for (int c = 0; c < engine.getCols(); c++) {
                if (!first) sb.append(',');
                first = false;
                appendCellJson(sb, grid[r][c]);
            }
        }
        sb.append("]}");
        return sb.toString();
    }

    private String buildEntityDetailJsonLocked(String id) {
        Entity e = engine.findEntityById(id);
        if (e == null) return null;

        int r = Math.max(0, Math.min(engine.getRows() - 1, (int) (e.getY() / engine.getCellSize())));
        int c = Math.max(0, Math.min(engine.getCols() - 1, (int) (e.getX() / engine.getCellSize())));
        GridCell cell = engine.getGrid()[r][c];
        double cellTempC = 18.0 + cell.getEffectiveTemperature(engine.getCurrentSeason(), engine.getClimateTrend()) * 16.0;

        StringBuilder sb = new StringBuilder(768);
        sb.append('{');
        sb.append("\"id\":\"").append(escapeJson(e.getId())).append('"');

        if (e instanceof Animal) {
            Animal a = (Animal) e;
            double massKg = (5.0 + a.getSize() * 80.0) * a.getStageMassMultiplier();
            sb.append(",\"type\":\"animal\"");
            sb.append(",\"name\":\"").append(escapeJson(a.getName())).append('"');
            sb.append(",\"speciesId\":\"").append(escapeJson(a.getSpeciesId())).append('"');
            sb.append(",\"speciesName\":\"").append(escapeJson(a.getSpeciesName())).append('"');
            sb.append(",\"x\":").append(fmt(round1(a.getX())));
            sb.append(",\"y\":").append(fmt(round1(a.getY())));
            sb.append(",\"vx\":").append(fmt(round2(a.getVx())));
            sb.append(",\"vy\":").append(fmt(round2(a.getVy())));
            sb.append(",\"age\":").append(a.getAge());
            sb.append(",\"maxLifespan\":").append(a.getMaxLifespan());
            sb.append(",\"lifeStage\":\"").append(a.getLifeStageKey()).append('"');
            sb.append(",\"energy\":").append(fmt(round2(a.getEnergy())));
            sb.append(",\"maxEnergy\":").append(fmt(round2(a.getMaxEnergy())));
            sb.append(",\"stamina\":").append(fmt(round2(a.getStamina())));
            sb.append(",\"maxStamina\":").append(fmt(round2(a.getMaxStamina())));
            sb.append(",\"exhausted\":").append(a.isExhausted());
            sb.append(",\"camouflageFactor\":").append(fmt(round3(a.getCamouflageFactor())));
            sb.append(",\"state\":\"").append(escapeJson(a.getState())).append('"');
            sb.append(",\"stateLabel\":\"").append(escapeJson(a.getStateLabel())).append('"');
            sb.append(",\"pregnant\":").append(a.isPregnant());
            sb.append(",\"gestationTicks\":").append(a.getGestationTicks());
            sb.append(",\"diseased\":").append(a.isDiseased());
            sb.append(",\"diseaseTimer\":").append(a.getDiseaseTimer());
            sb.append(",\"massKg\":").append(fmt(round2(massKg)));
            sb.append(",\"metabolism\":{")
              .append("\"basal\":").append(fmt(round3(a.getLastBasalCost())))
              .append(",\"locomotion\":").append(fmt(round3(a.getLastLocomotionCost())))
              .append(",\"thermal\":").append(fmt(round3(a.getLastThermalCost())))
              .append(",\"total\":").append(fmt(round3(a.getLastTotalCost())))
              .append('}');
            sb.append(",\"genes\":{")
              .append("\"size\":").append(fmt(round2(a.getSize())))
              .append(",\"speed\":").append(fmt(round2(a.getSpeed())))
              .append(",\"perception\":").append(fmt(round2(a.getPerception())))
              .append(",\"gestation\":").append(fmt(round2(a.getGestation())))
              .append(",\"offspringCount\":").append(fmt(round2(a.getOffspringCount())))
              .append(",\"aggression\":").append(fmt(round2(a.getAggression())))
              .append(",\"health\":").append(fmt(round2(a.getHealth())))
              .append(",\"aquatic\":").append(fmt(round2(a.getAquatic())))
              .append(",\"thermal\":").append(fmt(round2(a.getThermal())))
              .append(",\"colorHue\":").append((int) Math.round(a.getColorHue()))
              .append(",\"diet\":{\"meat\":").append(fmt(round2(a.getCarnivore())))
              .append(",\"plant\":").append(fmt(round2(a.getPlant())))
              .append(",\"carcass\":").append(fmt(round2(a.getCarcassDiet()))).append('}')
              .append('}');
        } else if (e instanceof Plant) {
            Plant p = (Plant) e;
            sb.append(",\"type\":\"plant\"");
            sb.append(",\"name\":\"").append(escapeJson(p.getName())).append('"');
            sb.append(",\"speciesId\":\"").append(escapeJson(p.getSpeciesId())).append('"');
            sb.append(",\"speciesName\":\"").append(escapeJson(p.getSpeciesName())).append('"');
            sb.append(",\"r\":").append(p.getR());
            sb.append(",\"c\":").append(p.getC());
            sb.append(",\"x\":").append(fmt(round1(p.getX())));
            sb.append(",\"y\":").append(fmt(round1(p.getY())));
            sb.append(",\"age\":").append(p.getAge());
            sb.append(",\"maxAge\":").append(p.getMaxAge());
            sb.append(",\"growth\":").append(fmt(round3(p.getGrowth())));
            sb.append(",\"energy\":").append(fmt(round2(p.getEnergy())));
            sb.append(",\"maxEnergy\":").append(fmt(round2(p.getMaxEnergy())));
            sb.append(",\"hasFruit\":").append(p.hasFruit());
            sb.append(",\"fruitCount\":").append(p.getFruitCount());
            sb.append(",\"state\":\"").append(escapeJson(p.getState())).append('"');
            sb.append(",\"maintenanceCost\":").append(fmt(round3(p.getMaintenanceCost())));
            sb.append(",\"limitingFactor\":\"").append(p.getLimitingFactorKey()).append('"');
            sb.append(",\"liebigScore\":").append(fmt(round3(p.getLiebigScore())));
            sb.append(",\"liebigFactors\":{")
              .append("\"nitrogen\":").append(fmt(round3(p.getNitrogenFactor())))
              .append(",\"water\":").append(fmt(round3(p.getWaterFactor())))
              .append(",\"light\":").append(fmt(round3(p.getLightFactor())))
              .append(",\"thermal\":").append(fmt(round3(p.getThermalFactor())))
              .append('}');
            sb.append(",\"genes\":{")
              .append("\"height\":").append(fmt(round2(p.getHeight())))
              .append(",\"rootEfficiency\":").append(fmt(round2(p.getRootEfficiency())))
              .append(",\"growthSpeed\":").append(fmt(round2(p.getGrowthSpeed())))
              .append(",\"defense\":").append(fmt(round2(p.getDefense())))
              .append(",\"fruitAttraction\":").append(fmt(round2(p.getFruitAttraction())))
              .append(",\"parasiteResistance\":").append(fmt(round2(p.getParasiteResistance())))
              .append(",\"thermal\":").append(fmt(round2(p.getThermal())))
              .append(",\"colorHue\":").append((int) Math.round(p.getColorHue()))
              .append('}');
        } else if (e instanceof Carcass) {
            Carcass k = (Carcass) e;
            sb.append(",\"type\":\"carcass\"");
            sb.append(",\"r\":").append(k.getR());
            sb.append(",\"c\":").append(k.getC());
            sb.append(",\"x\":").append(fmt(round1(k.getX())));
            sb.append(",\"y\":").append(fmt(round1(k.getY())));
            sb.append(",\"remainingEnergy\":").append(fmt(round2(k.getRemainingEnergy())));
            sb.append(",\"decayTimer\":").append(k.getDecayTimer());
        }

        sb.append(",\"cell\":{")
          .append("\"r\":").append(cell.getR())
          .append(",\"c\":").append(cell.getC())
          .append(",\"biome\":\"").append(cell.getBiome().getKey()).append('"')
          .append(",\"localTempOffset\":").append(fmt(round3(cell.getLocalTempOffset())))
          .append(",\"effectiveTempC\":").append(fmt(round1(cellTempC)))
          .append(",\"moisture\":").append(fmt(round3(cell.getMoisture())))
          .append(",\"waterRetention\":").append(fmt(round3(cell.getWaterRetention())))
          .append(",\"fertilityCap\":").append(fmt(round1(cell.getFertilityCap())))
          .append(",\"soilNitrogen\":").append(fmt(round2(cell.getSoilNitrogen())))
          .append(",\"organicBiomass\":").append(fmt(round2(cell.getOrganicBiomass())))
          .append('}');
        sb.append('}');
        return sb.toString();
    }

    private void appendSpeciesEntry(StringBuilder sb, SimulationEngine.SpeciesInfo sp) {
        sb.append('"').append(escapeJson(sp.speciesId)).append("\":{")
          .append("\"name\":\"").append(escapeJson(sp.name)).append('"')
          .append(",\"type\":\"").append(escapeJson(sp.type)).append('"')
          .append(",\"color\":\"").append(escapeJson(sp.color)).append('"')
          .append(",\"originGeneration\":").append(sp.originGeneration);
        if (sp.ancestorId != null) {
            sb.append(",\"ancestorId\":\"").append(escapeJson(sp.ancestorId)).append('"');
        }
        if (sp.divergentTrait != null) {
            sb.append(",\"divergentTrait\":\"").append(escapeJson(sp.divergentTrait)).append('"');
        }
        sb.append('}');
    }

    private static void appendCellJson(StringBuilder sb, GridCell cell) {
        sb.append('{')
          .append("\"r\":").append(cell.getR())
          .append(",\"c\":").append(cell.getC())
          .append(",\"biome\":\"").append(cell.getBiome().getKey()).append('"')
          .append(",\"localTempOffset\":").append(fmt(round3(cell.getLocalTempOffset())))
          .append(",\"waterRetention\":").append(fmt(round2(cell.getWaterRetention())))
          .append(",\"fertilityCap\":").append(fmt(round1(cell.getFertilityCap())))
          .append(",\"moisture\":").append(fmt(round2(cell.getMoisture())))
          .append(",\"soilNitrogen\":").append(fmt(round1(cell.getSoilNitrogen())))
          .append(",\"elevation\":").append(fmt(round2(cell.getElevation())))
          .append('}');
    }

    // ════════════════════════════════════════════════════
    // HTTP ESTÁTICO E UTILITÁRIOS
    // ════════════════════════════════════════════════════

    private void serveStaticFile(String requestPath, OutputStream out) throws IOException {
        String cleanPath = requestPath.equals("/") ? "/index.html" : requestPath;
        if (cleanPath.startsWith("/")) cleanPath = cleanPath.substring(1);

        Path target = webRoot.resolve(cleanPath).normalize();
        if (!target.startsWith(webRoot) || !Files.exists(target) || Files.isDirectory(target)) {
            sendHttpError(out, 404, "404 Not Found");
            return;
        }

        String lower = cleanPath.toLowerCase(Locale.ROOT);
        String contentType = "text/plain; charset=UTF-8";
        if (lower.endsWith(".html")) contentType = "text/html; charset=UTF-8";
        else if (lower.endsWith(".css")) contentType = "text/css; charset=UTF-8";
        else if (lower.endsWith(".js")) contentType = "application/javascript; charset=UTF-8";
        else if (lower.endsWith(".json")) contentType = "application/json; charset=UTF-8";
        else if (lower.endsWith(".png")) contentType = "image/png";
        else if (lower.endsWith(".svg")) contentType = "image/svg+xml";
        else if (lower.endsWith(".ico")) contentType = "image/x-icon";

        byte[] data = Files.readAllBytes(target);
        sendHttpResponse(out, 200, contentType, data);
    }

    private static void sendJsonResponse(OutputStream out, int status, String json) throws IOException {
        sendHttpResponse(out, status, "application/json; charset=UTF-8", json.getBytes(StandardCharsets.UTF_8));
    }

    private static void sendHttpError(OutputStream out, int status, String msg) throws IOException {
        sendHttpResponse(out, status, "text/plain; charset=UTF-8", msg.getBytes(StandardCharsets.UTF_8));
    }

    private static void sendHttpResponse(OutputStream out, int status, String contentType, byte[] body) throws IOException {
        String reason = status == 200 ? "OK" : (status == 204 ? "No Content" : (status == 404 ? "Not Found" : "Bad Request"));
        String headers = "HTTP/1.1 " + status + " " + reason + "\r\n"
            + "Content-Type: " + contentType + "\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Access-Control-Allow-Origin: *\r\n"
            + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
            + "Access-Control-Allow-Headers: Content-Type\r\n"
            + "Connection: close\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.UTF_8));
        if (body.length > 0) out.write(body);
        out.flush();
    }

    private static String readHttpHeaderBlock(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream(1024);
        int state = 0;
        int b;
        while ((b = in.read()) != -1) {
            buf.write(b);
            if (buf.size() > 32768) throw new IOException("Header too large");
            if (state == 0 && b == '\r') state = 1;
            else if (state == 1 && b == '\n') state = 2;
            else if (state == 2 && b == '\r') state = 3;
            else if (state == 3 && b == '\n') break;
            else state = (b == '\r') ? 1 : 0;
        }
        if (buf.size() == 0 && b == -1) return null;
        return buf.toString(StandardCharsets.UTF_8);
    }

    private static void readFully(InputStream in, byte[] dst, int off, int len) throws IOException {
        int total = 0;
        while (total < len) {
            int n = in.read(dst, off + total, len - total);
            if (n == -1) throw new EOFException("Unexpected EOF");
            total += n;
        }
    }

    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null || query.isEmpty()) return map;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0) {
                String k = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8);
                String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                map.put(k, v);
            }
        }
        return map;
    }

    private static Map<String, String> parseSimpleJsonObject(String json) {
        Map<String, String> result = new HashMap<>();
        if (json == null) return result;
        int i = 0;
        int n = json.length();
        while (i < n && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= n || json.charAt(i) != '{') return result;
        i++;
        while (i < n) {
            while (i < n && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ',')) i++;
            if (i >= n || json.charAt(i) == '}') break;
            if (json.charAt(i) != '"') break;
            int[] nextIdx = new int[1];
            String key = readJsonString(json, i, nextIdx);
            i = nextIdx[0];
            while (i < n && Character.isWhitespace(json.charAt(i))) i++;
            if (i >= n || json.charAt(i) != ':') break;
            i++;
            while (i < n && Character.isWhitespace(json.charAt(i))) i++;
            if (i >= n) break;
            if (json.charAt(i) == '"') {
                String val = readJsonString(json, i, nextIdx);
                i = nextIdx[0];
                result.put(key, val);
            } else {
                int start = i;
                while (i < n && json.charAt(i) != ',' && json.charAt(i) != '}' && !Character.isWhitespace(json.charAt(i))) {
                    i++;
                }
                result.put(key, json.substring(start, i));
            }
        }
        return result;
    }

    private static String readJsonString(String s, int quoteStart, int[] outNextIdx) {
        StringBuilder sb = new StringBuilder();
        int i = quoteStart + 1;
        while (i < s.length()) {
            char c = s.charAt(i++);
            if (c == '\\' && i < s.length()) {
                char esc = s.charAt(i++);
                if (esc == 'n') sb.append('\n');
                else if (esc == 'r') sb.append('\r');
                else if (esc == 't') sb.append('\t');
                else sb.append(esc);
            } else if (c == '"') {
                break;
            } else {
                sb.append(c);
            }
        }
        outNextIdx[0] = i;
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 4);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format(Locale.US, "\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }

    private static double round1(double v) {
        return Double.isFinite(v) ? Math.round(v * 10.0) / 10.0 : 0.0;
    }

    private static double round2(double v) {
        return Double.isFinite(v) ? Math.round(v * 100.0) / 100.0 : 0.0;
    }

    private static double round3(double v) {
        return Double.isFinite(v) ? Math.round(v * 1000.0) / 1000.0 : 0.0;
    }

    private static String fmt(double v) {
        if (!Double.isFinite(v)) return "0";
        if (v == (long) v) return Long.toString((long) v);
        return Double.toString(v);
    }

    private static int parseIntSafe(String s, int def) {
        try { return s == null ? def : Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return def; }
    }

    private static double parseDoubleSafe(String s, double def) {
        try { return s == null ? def : Double.parseDouble(s.trim()); }
        catch (NumberFormatException e) { return def; }
    }

    public static void main(String[] args) {
        boolean autoStart = false;
        for (String arg : args) {
            if ("--autostart".equalsIgnoreCase(arg)) autoStart = true;
        }
        try {
            new SimulationServer().start(autoStart);
        } catch (IOException e) {
            System.err.println("Erro ao iniciar servidor: " + e.getMessage());
        }
    }
}
