function configureCanvas(window) {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const dpr = window.devicePixelRatio;
        const cssWidth = window.innerWidth;
        const cssHeight = window.innerHeight;

        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);

    return {
        canvas,
        ctx,
        resizeCanvas
    };
}

export { configureCanvas };
