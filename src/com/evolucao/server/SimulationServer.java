package com.evolucao.server;

import com.evolucao.engine.SimulationEngine;
import com.evolucao.model.*;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.file.Files;

/**
 * Servidor HTTP em Java nativo para hospedar a interface web
 * e fornecer o estado da simulação.
 */
public class SimulationServer {
    private static final int PORT = 8080;
    private final SimulationEngine engine;

    public SimulationServer() {
        this.engine = new SimulationEngine(24, 32, BiomeType.FERTILE_SOIL);
        initDemoWorld();
    }

    private void initDemoWorld() {
        // Popula algumas plantas e animais iniciais de demonstração
        for (int i = 0; i < 25; i++) {
            int r = (int) (Math.random() * 24);
            int c = (int) (Math.random() * 32);
            engine.addPlant(new Plant("p" + i, "Grama", r, c, 0.5, 0.5, 0.6, 0.2, 0.4, 0.5, 0.0));
        }
        for (int i = 0; i < 15; i++) {
            boolean pred = (i % 3 == 0);
            engine.addAnimal(new Animal("a" + i, pred ? "Predador" : "Herbívoro", pred ? "Lobo" : "Lebre",
                    Math.random() * 700 + 20, Math.random() * 500 + 20,
                    pred ? 0.7 : 0.4, pred ? 0.8 : 0.1, pred ? 0.1 : 0.9,
                    pred ? 0.6 : 0.7, 0.6, 0.4, 0.4, pred ? 0.7 : 0.2, 0.5, 0.0));
        }
    }

    public void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

        // Roteador de arquivos estáticos da pasta web/
        server.createContext("/", new StaticFileHandler());

        // API de estado da simulação
        server.createContext("/api/state", exchange -> {
            String json = String.format("{\"ticks\":%d,\"generation\":%d,\"season\":\"%s\",\"animals\":%d,\"plants\":%d,\"carcasses\":%d}",
                    engine.getTotalTicks(), engine.getGeneration(), engine.getCurrentSeason().getName(),
                    engine.getAnimals().size(), engine.getPlants().size(), engine.getCarcasses().size());
            byte[] bytes = json.getBytes();
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
        });

        // API de avanço de ticks
        server.createContext("/api/tick", exchange -> {
            engine.updateTick();
            String res = "{\"ok\":true}";
            exchange.sendResponseHeaders(200, res.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(res.getBytes()); }
        });

        server.setExecutor(null);
        server.start();
        System.out.println("==================================================");
        System.out.println("   SIMULADOR DE EVOLUÇÃO — MOTOR EM JAVA ATIVO   ");
        System.out.println("   Acesse no navegador: http://localhost:" + PORT + "      ");
        System.out.println("==================================================");
    }

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) path = "/index.html";

            File file = new File("web" + path);
            if (!file.exists()) {
                file = new File("." + path);
            }

            if (!file.exists() || file.isDirectory()) {
                String notFound = "404 Not Found";
                exchange.sendResponseHeaders(404, notFound.length());
                try (OutputStream os = exchange.getResponseBody()) { os.write(notFound.getBytes()); }
                return;
            }

            String contentType = "text/plain";
            if (path.endsWith(".html")) contentType = "text/html; charset=UTF-8";
            else if (path.endsWith(".css")) contentType = "text/css; charset=UTF-8";
            else if (path.endsWith(".js")) contentType = "application/javascript; charset=UTF-8";
            else if (path.endsWith(".png")) contentType = "image/png";

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, file.length());
            try (OutputStream os = exchange.getResponseBody(); FileInputStream fis = new FileInputStream(file)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = fis.read(buf)) >= 0) os.write(buf, 0, n);
            }
        }
    }

    public static void main(String[] args) {
        try {
            new SimulationServer().start();
        } catch (IOException e) {
            System.err.println("Erro ao iniciar servidor: " + e.getMessage());
        }
    }
}
