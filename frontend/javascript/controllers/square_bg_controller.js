import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["canvas"];

  connect() {
    this.canvas = this.canvasTarget;
    if (this.canvas) {
      this.context = this.canvas.getContext("2d");
      this.noiseFilter = document.getElementById("noiseFilter");
      this.baseColor = [this.random(255), this.random(255), this.random(255)];
      this.squareSize = 134;

      // Initialize the canvas and start rendering
      this.initializeCanvas();
    } else {
      console.error("Canvas element not found.");
    }
  }

  disconnect() {
    window.removeEventListener("resize", this.resizeCanvas.bind(this));
    this.canvas.removeEventListener("mousemove", this.mouseMoved.bind(this));
    cancelAnimationFrame(this.animationFrame);
  }

  initializeCanvas() {
    this.resizeCanvas();
    this.setupSquares();
    window.addEventListener("resize", this.resizeCanvas.bind(this));
    this.canvas.addEventListener("mousemove", this.mouseMoved.bind(this));
    this.animationFrame = requestAnimationFrame(this.draw.bind(this));
  }

  resizeCanvas() {
    this.canvas.width = document.body.clientWidth;
    this.canvas.height = document.body.scrollHeight; // Change to scrollHeight
    this.setupSquares();
  }

  setupSquares() {
    this.squares = [];
    for (let x = 0; x < this.canvas.width; x += this.squareSize) {
      for (let y = 0; y < this.canvas.height; y += this.squareSize) {
        let gradientOffset = this.random(-30, 30);
        this.squares.push({
          x,
          y,
          opacity: this.random(255),
          targetOpacity: this.random(255),
          gradientOffset,
        });
      }
    }
  }

  draw() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.squares.forEach((square) => {
      if (square.opacity !== square.targetOpacity) {
        square.opacity += (square.targetOpacity - square.opacity) * 0.05;
      }

      for (let i = 0; i < this.squareSize; i++) {
        let gradientAlpha = this.map(
          i,
          0,
          this.squareSize,
          square.opacity,
          square.opacity - 40 + square.gradientOffset
        );
        this.context.fillStyle = `rgba(${this.baseColor[0]}, ${this.baseColor[1]}, ${this.baseColor[2]}, ${
          gradientAlpha / 255
        })`;
        this.context.fillRect(square.x, square.y + i, this.squareSize, 1);
      }
    });

    // Apply the noise filter to the canvas
    this.canvas.style.filter = "url(#noiseFilter)";

    this.animationFrame = requestAnimationFrame(this.draw.bind(this));
  }

  mouseMoved(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    this.squares.forEach((square) => {
      if (
        mouseX >= square.x &&
        mouseX < square.x + this.squareSize &&
        mouseY >= square.y &&
        mouseY < square.y + this.squareSize
      ) {
        if (!square.hovered) {
          square.targetOpacity = this.random(255);
          square.hovered = true;
        }
      } else {
        square.hovered = false;
      }
    });
  }

  random(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }
}
