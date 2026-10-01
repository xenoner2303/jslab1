function configureCanvas(window) {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const dpr = window.devicePixelRatio;
        const cssWidth = window.innerWidth;
        const cssHeight = window.innerHeight;

        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;

        ctx.scale(dpr, dpr); // масштабування контексту, щоб малювати в CSS пікселях
    }

    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);

    return {
        ctx,
        resizeCanvas
    };
}

export { configureCanvas };
