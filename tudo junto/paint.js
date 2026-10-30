// ====================================================
//  PAINT.JS — Mini Editor de Desenho de Partes / Sprites
//  Permite desenhar cada componente na hora (Pincel, Borracha, Balde)
// ====================================================

class MiniPaint {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 128;
    this.height = 128;

    this.isDrawing = false;
    this.currentTool = 'brush'; // 'brush', 'eraser', 'fill'
    this.currentColor = '#3fb950';
    this.brushSize = 3;

    this.targetType = null; // 'animal' ou 'plant'
    this.targetPart = null; // 'body', 'limbs', etc.
    this.targetTitle = '';

    this.undoStack = [];
    this.maxUndo = 15;
  }

  init() {
    this.canvas = document.getElementById('paint-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.setupEvents();
    this.clear(false);
  }

  setupEvents() {
    const c = this.canvas;

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      let clientX = e.clientX;
      let clientY = e.clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      return {
        x: Math.floor((clientX - rect.left) * scaleX),
        y: Math.floor((clientY - rect.top) * scaleY)
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.saveUndoState();
      const pos = getPos(e);

      if (this.currentTool === 'fill') {
        this.floodFill(pos.x, pos.y, this.currentColor);
        return;
      }

      this.isDrawing = true;
      this.drawAt(pos.x, pos.y, true);
    };

    const moveDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.drawAt(pos.x, pos.y, false);
    };

    const endDraw = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.ctx.beginPath();
      }
    };

    c.addEventListener('mousedown', startDraw);
    c.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    c.addEventListener('touchstart', startDraw, { passive: false });
    c.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', endDraw);

    // Color picker
    const picker = document.getElementById('paint-color-picker');
    if (picker) {
      picker.addEventListener('input', (e) => {
        this.setColor(e.target.value);
      });
    }
  }

  drawAt(x, y, isStart) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.currentColor;
      ctx.fillStyle = this.currentColor;
    }

    ctx.lineWidth = this.brushSize;

    if (isStart) {
      ctx.beginPath();
      ctx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  floodFill(startX, startY, fillHex) {
    if (startX < 0 || startX >= this.width || startY < 0 || startY >= this.height) return;

    const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = imgData.data;

    const startIndex = (startY * this.width + startX) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    // Converte fillHex para RGBA
    const tempDiv = document.createElement('div');
    tempDiv.style.color = fillHex;
    document.body.appendChild(tempDiv);
    const rgbStr = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    const match = rgbStr.match(/\d+/g);
    const fillR = parseInt(match[0]);
    const fillG = parseInt(match[1]);
    const fillB = parseInt(match[2]);
    const fillA = 255;

    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const matchStart = (idx) => {
      return (
        Math.abs(data[idx] - startR) < 15 &&
        Math.abs(data[idx + 1] - startG) < 15 &&
        Math.abs(data[idx + 2] - startB) < 15 &&
        Math.abs(data[idx + 3] - startA) < 15
      );
    };

    const queue = [[startX, startY]];
    const visited = new Uint8Array(this.width * this.height);

    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const idx = (y * this.width + x) * 4;
      const vIdx = y * this.width + x;

      if (visited[vIdx]) continue;
      visited[vIdx] = 1;

      if (!matchStart(idx)) continue;

      data[idx]     = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      if (x > 0) queue.push([x - 1, y]);
      if (x < this.width - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < this.height - 1) queue.push([x, y + 1]);
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  saveUndoState() {
    if (this.undoStack.length >= this.maxUndo) this.undoStack.shift();
    this.undoStack.push(this.ctx.getImageData(0, 0, this.width, this.height));
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const last = this.undoStack.pop();
    this.ctx.putImageData(last, 0, 0);
  }

  clear(saveUndo = true) {
    if (saveUndo) this.saveUndoState();
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.paint-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  setColor(color) {
    this.currentColor = color;
    const picker = document.getElementById('paint-color-picker');
    if (picker) picker.value = color;

    document.querySelectorAll('.paint-palette-color').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  setBrushSize(size) {
    this.brushSize = size;
    document.querySelectorAll('.paint-size-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
    });
  }

  /**
   * Abre o editor Paint para uma parte específica
   */
  open(type, part, partTitle) {
    this.targetType = type;
    this.targetPart = part;
    this.targetTitle = partTitle;

    document.getElementById('paint-modal-title').textContent = `🎨 Desenhar: ${partTitle} (${type === 'animal' ? 'Animal' : 'Planta'})`;

    this.undoStack = [];
    this.clear(false);

    // Carrega imagem existente se já houver uma desenhada
    const existingDataUrl = (type === 'animal') ? currentAnimalImages[part] : currentPlantImages[part];
    if (existingDataUrl) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.width, this.height);
      };
      img.src = existingDataUrl;
    }

    const modal = document.getElementById('paint-modal');
    if (modal) modal.style.display = 'flex';
  }

  close() {
    const modal = document.getElementById('paint-modal');
    if (modal) modal.style.display = 'none';
  }

  apply() {
    const dataUrl = this.canvas.toDataURL('image/png');

    if (this.targetType === 'animal') {
      currentAnimalImages[this.targetPart] = dataUrl;
      updateComponentBox('animal', this.targetPart, dataUrl);
      renderAnimalPreview();
    } else {
      currentPlantImages[this.targetPart] = dataUrl;
      updateComponentBox('plant', this.targetPart, dataUrl);
      renderPlantPreview();
    }

    toast(`🎨 Componente "${this.targetTitle}" desenhado e aplicado com sucesso!`);
    this.close();
  }
}

// Instância global do Mini Paint
const miniPaint = new MiniPaint();
