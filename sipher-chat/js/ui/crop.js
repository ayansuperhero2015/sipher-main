import { h } from "../dom.js";
import { cropToDataURL } from "../image.js";
import { openModal } from "./modal.js";

const STAGE = 280; // on-screen crop area, in CSS pixels
const MAX_ZOOM = 5;

// Lets the user drag and zoom to choose which part of the image is kept.
// Resolves to a data URL, or null if cancelled.
export function cropModal(bitmap, title = "Edit Image") {
  return new Promise((resolve) => {
    let result = null;
    openModal({
      title,
      subtitle: "Drag to reposition. Scroll or use the slider to zoom.",
      onClose: () => {
        bitmap.close();
        resolve(result);
      },
      render: (close) => {
        const dpr = window.devicePixelRatio || 1;
        const canvas = h("canvas", {
          class: "crop-canvas",
          width: STAGE * dpr,
          height: STAGE * dpr,
          tabIndex: 0,
          "aria-label": "Crop area. Arrow keys move, plus and minus zoom.",
        });
        const ctx = canvas.getContext("2d");

        // The image is drawn at `scale` with its top-left corner at (x, y),
        // in stage pixels. `cover` is the smallest scale that fills the stage.
        const cover = Math.max(STAGE / bitmap.width, STAGE / bitmap.height);
        let zoom = 1;
        let scale = cover;
        let x = (STAGE - bitmap.width * scale) / 2;
        let y = (STAGE - bitmap.height * scale) / 2;

        function clamp() {
          x = Math.min(0, Math.max(STAGE - bitmap.width * scale, x));
          y = Math.min(0, Math.max(STAGE - bitmap.height * scale, y));
        }

        function draw() {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, STAGE, STAGE);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(
            bitmap,
            x,
            y,
            bitmap.width * scale,
            bitmap.height * scale,
          );
          // Dim everything outside the circle that avatars are shown in.
          ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
          ctx.beginPath();
          ctx.rect(0, 0, STAGE, STAGE);
          ctx.arc(STAGE / 2, STAGE / 2, STAGE / 2 - 2, 0, Math.PI * 2, true);
          ctx.fill("evenodd");
          ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(STAGE / 2, STAGE / 2, STAGE / 2 - 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Zooms keeping the stage point (cx, cy) fixed under the cursor.
        function setZoom(next, cx = STAGE / 2, cy = STAGE / 2) {
          zoom = Math.min(MAX_ZOOM, Math.max(1, next));
          const nextScale = cover * zoom;
          x = cx - ((cx - x) * nextScale) / scale;
          y = cy - ((cy - y) * nextScale) / scale;
          scale = nextScale;
          clamp();
          slider.value = String(zoom);
          draw();
        }

        function stagePoint(e) {
          const rect = canvas.getBoundingClientRect();
          return [
            ((e.clientX - rect.left) * STAGE) / rect.width,
            ((e.clientY - rect.top) * STAGE) / rect.height,
          ];
        }

        let drag = null;
        canvas.addEventListener("pointerdown", (e) => {
          canvas.setPointerCapture(e.pointerId);
          const [px, py] = stagePoint(e);
          drag = { px, py, x, y };
        });
        canvas.addEventListener("pointermove", (e) => {
          if (!drag) return;
          const [px, py] = stagePoint(e);
          x = drag.x + px - drag.px;
          y = drag.y + py - drag.py;
          clamp();
          draw();
        });
        const endDrag = () => (drag = null);
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            const [px, py] = stagePoint(e);
            setZoom(zoom * Math.exp(-e.deltaY * 0.002), px, py);
          },
          { passive: false },
        );
        canvas.addEventListener("keydown", (e) => {
          const step = e.shiftKey ? 20 : 5;
          const moves = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          };
          if (moves[e.key]) {
            x += moves[e.key][0];
            y += moves[e.key][1];
            clamp();
            draw();
          } else if (e.key === "+" || e.key === "=") setZoom(zoom * 1.1);
          else if (e.key === "-") setZoom(zoom / 1.1);
          else return;
          e.preventDefault();
        });

        const slider = h("input", {
          type: "range",
          class: "crop-zoom",
          min: "1",
          max: String(MAX_ZOOM),
          step: "0.01",
          value: "1",
          "aria-label": "Zoom",
          oninput: () => setZoom(Number(slider.value)),
        });

        clamp();
        draw();

        return h(
          "div",
          { class: "modal-form" },
          h("div", { class: "crop-stage" }, canvas),
          h(
            "div",
            { class: "crop-controls" },
            h("span", { class: "muted small" }, "−"),
            slider,
            h("span", { class: "muted small" }, "+"),
          ),
          h(
            "div",
            { class: "modal-actions" },
            h(
              "button",
              { type: "button", class: "btn ghost", onclick: close },
              "Cancel",
            ),
            h(
              "button",
              {
                type: "button",
                class: "btn primary",
                onclick: () => {
                  try {
                    result = cropToDataURL(
                      bitmap,
                      -x / scale,
                      -y / scale,
                      STAGE / scale,
                    );
                  } catch (err) {
                    result = err;
                  }
                  close();
                },
              },
              "Apply",
            ),
          ),
        );
      },
    });
  });
}
