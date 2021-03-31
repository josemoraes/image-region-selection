window.onload = () => {
  const imageMaxLength = 500;
  DOM.$elements["canvas"] = document.getElementById("imageCanvas");
  DOM.$elements["overlay"] = document.getElementById("overlay");
  DOM.$elements["cursorSection"] = document.getElementById("mousePosition");
  DOM.$elements["tagInputSection"] = document.getElementById("tag-section");
  DOM.$elements["imageInput"] = document.getElementById("image-input");
  DOM.$elements["addTagButton"] = document.getElementById("btn-add-tag");
  DOM.$elements["inputTag"] = document.getElementById("input-classify");
  DOM.$elements["toggleResultTriggers"] = document.querySelectorAll(
    ".toggle-classifier-results"
  );
  DOM.$elements["classifierSection"] = document.getElementById(
    "classifier-section"
  );
  DOM.$elements["classifiersResult"] = document.getElementById(
    "classifiers-result"
  );
  Canvas.$canvas = DOM.$elements.canvas;
  Canvas.$overlay = DOM.$elements.overlay;
  Canvas.canvasContext = Canvas.$canvas.getContext("2d");
  Canvas.overlayContext = Canvas.$overlay.getContext("2d");

  DOM.$elements.toggleResultTriggers.forEach(
    Listeners.onToggleClassifierResults
  );
  Listeners.onImageChange(imageMaxLength);

  cocoSsd.load().then(model => {
    Detector.model = model
  })
};

const DOM = {
  $elements: {},
};

const Classifiers = {
  current: {},
  list: [],
};

const Detector = {
  model: null,
  predictedObjects: [],
  detect(canvas) {
    if (this.model) {
      this.model.detect(canvas).then(predictions => {
        // Saves the detected objects
        this.predictObjects = predictions

        // Clear canvas for the predictions
        Canvas.clearOverlay();

        // Draw predictions
        predictions.forEach(prediction => {
          this.updateClassifiers(prediction);
          const [x, y, width, height] = prediction.bbox;
          Canvas.drawBoundingBox(x, y, width, height);
        });
      });
    }
  },
  updateClassifiers(prediction) {
    const [x, y, width, height] = prediction.bbox;

    Classifiers.current = {
      topLeft: { x: x, y: y },
      bottomLeft: { x: x, y: y + height },
      bottomRight: { x: x + width, y: y + height },
      topRight: { x: x + width, y: y },
      tag: prediction.class,
      score: prediction.score,
    };
    Classifiers.list.push(Classifiers.current);

    Listeners.DOMElements.classifiersResult.innerHTML = JSON.stringify(
      Classifiers.list,
      null,
      "\t"
    );
  }
};

const Listeners = {
  DOMElements: DOM.$elements,
  onToggleClassifierResults($element) {
    $element.addEventListener("click", (e) => {
      if (
        Listeners.DOMElements.classifierSection.classList.contains("hidden")
      ) {
        Listeners.DOMElements.classifierSection.classList.remove("hidden");
      } else {
        Listeners.DOMElements.classifierSection.classList.add("hidden");
      }
    });
  },
  onImageChange(maxLength) {
    Listeners.DOMElements.imageInput.addEventListener("change", (e) => {
      if (Listeners.DOMElements.imageInput.files.length == 0) {
        return;
      }

      let img = new Image();

      var reader = new FileReader();
      reader.onload = function (evt) {
        img.onload = function () {
          if (img.width > maxLength) {
            img.height = (maxLength * img.height) / img.width;
            img.width = maxLength;
          } else if (img.height > maxLength) {
            img.width = (maxLength * img.width) / img.height;
            img.height = maxLength;
          }
          Canvas.$canvas.width = img.width;
          Canvas.$canvas.height = img.height;
          Canvas.$overlay.width = Canvas.$canvas.width;
          Canvas.$overlay.height = Canvas.$canvas.height;

          Canvas.canvasContext.drawImage(img, 0, 0, img.width, img.height);
          Detector.detect(Canvas.$canvas);
        };
        img.src = evt.target.result;

        Listeners.onOverlayMouseDown();
        Listeners.onOverlayMouseMove();
        Listeners.onOverlayMouseUp();
        Listeners.onAddTagButtonClick();
      };
      reader.readAsDataURL(Listeners.DOMElements.imageInput.files[0]);
    });
  },
  onOverlayMouseDown() {
    Listeners.DOMElements.overlay.addEventListener("mousedown", (e) => {
      Canvas.initialPoint.x = e.offsetX;
      Canvas.initialPoint.y = e.offsetY;
      Canvas.isDrawing = true;
      Canvas.clearOverlay();
      Canvas.$overlay.style.cursor = "crosshair";
    });
  },
  onOverlayMouseMove() {
    Listeners.DOMElements.overlay.addEventListener("mousemove", (e) => {
      if (Canvas.isDrawing) {
        Canvas.drawReactangle(e);
      }
      Listeners.DOMElements.cursorSection.innerHTML =
        "Mouse Cursor: (" + e.offsetX + ", " + e.offsetY + ")";
    });
  },
  onOverlayMouseUp() {
    Listeners.DOMElements.overlay.addEventListener("mouseup", (e) => {
      if (Canvas.isDrawing) {
        Canvas.isDrawing = false;

        Listeners.DOMElements.cursorSection.innerHTML =
          "Mouse Cursor: (" + e.offsetX + ", " + e.offsetY + ")";
        Canvas.$overlay.style.cursor = "default";
        Canvas.finalPoint.x = e.offsetX;
        Canvas.finalPoint.y = e.offsetY;
        Classifiers.current = {
          topLeft: { x: Canvas.initialPoint.x, y: Canvas.initialPoint.y },
          bottomLeft: { x: Canvas.initialPoint.x, y: Canvas.finalPoint.y },
          bottomRight: { x: Canvas.finalPoint.x, y: Canvas.finalPoint.y },
          topRight: { x: Canvas.finalPoint.x, y: Canvas.initialPoint.y },
        };
        Listeners.DOMElements.tagInputSection.classList.remove("hidden");
      }
    });
  },
  onAddTagButtonClick() {
    Listeners.DOMElements.addTagButton.addEventListener("click", (e) => {
      Classifiers.current = {
        ...Classifiers.current,
        tag: Listeners.DOMElements.inputTag.value,
      };
      Classifiers.list.push(Classifiers.current);
      Listeners.DOMElements.classifiersResult.innerHTML = JSON.stringify(
        Classifiers.list,
        null,
        "\t"
      );
      Canvas.clearOverlay();
      Listeners.DOMElements.inputTag.value = "";
      Listeners.DOMElements.tagInputSection.classList.add("hidden");
    });
  },
};

const Canvas = {
  $canvas: null,
  $overlay: null,
  canvasContext: null,
  overlayContext: null,
  initialPoint: {
    x: 0,
    y: 0,
  },
  finalPoint: {
    x: 0,
    y: 0,
  },
  isDrawing: false,
  clearOverlay() {
    Canvas.overlayContext.clearRect(
      0,
      0,
      Canvas.$overlay.width,
      Canvas.$overlay.height
    );
    Canvas.overlayContext.strokeStyle = "#ff0000";
    Canvas.overlayContext.lineWidth = 2;
  },
  drawReactangle(event) {
    Canvas.clearOverlay();
    Canvas.overlayContext.beginPath();
    Canvas.overlayContext.rect(
      Canvas.initialPoint.x,
      Canvas.initialPoint.y,
      event.offsetX - Canvas.initialPoint.x,
      event.offsetY - Canvas.initialPoint.y
    );
    Canvas.overlayContext.stroke();
  },
  drawBoundingBox(x, y, width, height) {
    Canvas.overlayContext.beginPath();
    Canvas.overlayContext.rect(x, y, width, height);
    Canvas.overlayContext.stroke();
  }
};
