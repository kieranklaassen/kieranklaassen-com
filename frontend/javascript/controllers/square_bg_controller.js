import { Controller } from "@hotwired/stimulus";
import p5 from "p5";

export default class extends Controller {
  static targets = ["canvas"];

  connect() {
    this.p5 = new p5((p) => this.sketch(p), this.canvasTarget);
    window.addEventListener("resize", () => this.windowResized());
  }

  sketch(p) {
    p.setup = () => {
      p.createCanvas(window.innerWidth, window.innerHeight);
      this.baseColor = [this.random(255), this.random(255), this.random(255)];
      this.squareSize = 64;
      this.setupSquares(p);
      this.setupNoise(p);
      p.noStroke(); // No border
    };

    p.draw = () => {
      this.drawBackgroundAndSquares(p);
      p.image(this.noiseGraphics, 0, 0);
    };

    p.mouseMoved = () => {
      this.mouseMoved(p);
    };
  }

  setupSquares(p) {
    this.squares = [];
    for (let x = 0; x < p.width; x += this.squareSize) {
      for (let y = 0; y < p.height; y += this.squareSize) {
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

  setupNoise(p) {
    this.noiseGraphics = p.createGraphics(p.width, p.height);
    this.noiseGraphics.loadPixels();
    for (let i = 0; i < this.noiseGraphics.pixels.length; i += 4) {
      let noiseVal = this.random(255);
      this.noiseGraphics.pixels[i] = noiseVal;
      this.noiseGraphics.pixels[i + 1] = noiseVal;
      this.noiseGraphics.pixels[i + 2] = noiseVal;
      this.noiseGraphics.pixels[i + 3] = 50;
    }
    this.noiseGraphics.updatePixels();
  }

  drawBackgroundAndSquares(p) {
    p.background(255); // White background
    this.squares.forEach((square) => {
      if (square.opacity !== square.targetOpacity) {
        square.opacity = p.lerp(square.opacity, square.targetOpacity, 0.05);
      }

      // Create gradient effect with random variation
      for (let i = 0; i < this.squareSize; i++) {
        let gradientAlpha = p.map(i, 0, this.squareSize, square.opacity, square.opacity - 40 + square.gradientOffset);
        p.fill(this.baseColor[0], this.baseColor[1], this.baseColor[2], gradientAlpha);
        p.rect(square.x, square.y + i, this.squareSize, 1);
      }
    });
  }

  mouseMoved(p) {
    this.squares.forEach((square) => {
      if (
        p.mouseX >= square.x &&
        p.mouseX < square.x + this.squareSize &&
        p.mouseY >= square.y &&
        p.mouseY < square.y + this.squareSize
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

  windowResized() {
    this.p5.resizeCanvas(window.innerWidth, window.innerHeight);
    this.setupSquares(this.p5);
    this.setupNoise(this.p5); // Re-create noise when window is resized
  }

  random(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
