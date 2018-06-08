function recalcPallete(){
	var numColors = parseInt($('input[type=number]').get(0).value);
	console.log("recalc with " + numColors + " colors");
	//copy image data to canvas
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	var img = document.getElementById('image');
	context.drawImage(img, 0, 0 );
	var imgData = context.getImageData(0, 0, img.width, img.height);
	var width = img.width, height = img.height;
	//the real algorithm
}

