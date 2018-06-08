var weightIsDirty = true;
var numColors;
//array of the weight for each color for each pixel: size is image size * numColors
var pixelPalleteWeight;
//array of the real pixel val of the image: size is image size * 4(rgba)
var imgData;
var width, height;

function recalcPallete(){
	numColors = parseInt($('input[type=number]').get(0).value);
	console.log("recalc with " + numColors + " colors");
	//copy image data to canvas
	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext('2d');
	var img = document.getElementById('image');
	ctx.drawImage(img, 0, 0 );
	imgData = ctx.getImageData(0, 0, img.width, img.height);
	width = img.width;
	height = img.height;
	weightIsDirty = true;
	//the real algorithm
	
}

function modColor(){
	if(weightIsDirty) calcWeight();
	weightIsDirty = false;

}

function calcWeight(){

}


