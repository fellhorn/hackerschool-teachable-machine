function getClippedRegion(image, x, y, width, height) {

    var canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    //                   source region         dest. region
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

    return canvas;
}

module.exports = {
    getClippedRegion
}