var numColors;
//imgData.data => array of the real pixel val of the image: size is image size * 4(rgba)
var imgData;
var canvas;
var w, h;
var kmeansLabV;
var modLabV;
var sigma;
var lambda;//numColors*numColors matrix

var clickedColorIndex;

function indexOfMax(arr) {
    if (arr.length === 0) {
        return -1;
    }
    var max = arr[0];
    var maxIndex = 0;
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }
    return maxIndex;
}

function recalcPallete(){
	var tmpNumColors = parseInt($('input[type=number]').get(0).value);
	for(var i = tmpNumColors+1; i < numColors+1; i++){
		if( $('#cs_'+i).length > 0 ){
			$('#cs_'+i).remove();
		}
	}
	numColors = tmpNumColors;
	console.log("recalc with " + numColors + " colors");
	for(var i = 1; i < numColors+1; i++){
		if( $('#cs_'+i).length > 0 ) continue;
		var col = document.createElement("div");
		col.className = 'color_sample';
		col.id = 'cs_'+i;
		$('#pallete-container').append(col);
	}
	var img = document.getElementById('image');
	w = img.width;
	h = img.height;
	//copy image data to canvas
	if(!canvas) canvas = document.getElementById('modImageCanvas');
	canvas.width = w;
	canvas.height = h;
	var ctx = canvas.getContext('2d');
	
	ctx.drawImage(img, 0, 0 );
	try{
		imgData = ctx.getImageData(0, 0, img.width, img.height);
	}catch(err){
		console.log(err.message);
		console.log("getImageData failed, abort recalc");
		return;
	}
	//the real algorithm
	var histN = [];
	var histV = [];
	for(var i = 0; i < 4096; i++){
		histN[i] = 0;
		histV[i*3] = 0;
		histV[i*3+1] = 0;
		histV[i*3+2] = 0;
	}
	var R,G,B,index;
	//calc hostogram
	for(var i = 0; i < h; i++){
		for(var j = 0; j < w; j++){
			R = imgData.data[4*(i*w+j)];
			G = imgData.data[4*(i*w+j)+1];
			B = imgData.data[4*(i*w+j)+2];
			index = Math.floor(R/16)*256+Math.floor(G/16)*16+Math.floor(B/16);
			//console.log(''+R+','+G+','+B+'->'+index);
			histN[(index)]++;
			histV[(index)*3]+=R;
			histV[(index)*3+1]+=G;
			histV[(index)*3+2]+=B;
		}
	}
	//mean color value for each color group and convert to lab space
	var histLabV = [];
	var tmpLab;
	for(var i = 0; i < 4096; i++){
		if(histN[i]>0){
			histV[i*3]/=histN[i];
			histV[i*3+1]/=histN[i];
			histV[i*3+2]/=histN[i];
			tmpLab = RGB2LAB(histV[i*3],histV[i*3+1],histV[i*3+2]);
			histLabV[i*3] = tmpLab[0];
			histLabV[i*3+1] = tmpLab[1];
			histLabV[i*3+2] = tmpLab[2];
		}
	}
	//assign initial values to kmeans
	var kmeans = [-1];
	var histW = histN.slice(0);//clone array for weight
	var sigma = 80;
	for(var i = 1; i < numColors+1; i++){
		var maxInd = indexOfMax(histW);
		//console.log(maxInd);
		kmeans[i] = maxInd;
		for(var j = 0; j < 4096; j++){
			if(histN[j]>0){
				var d2 = sqr(histLabV[j*3]-histLabV[maxInd*3])+sqr(histLabV[j*3+1]-histLabV[maxInd*3+1])+sqr(histLabV[j*3+2]-histLabV[maxInd*3+2]);
				histW[j] *= (1-Math.exp(-d2/(sigma*sigma)));
			}
		}
	}
	//do k-means
	kmeansLabV = [0,0,0];
	var kmeansConverge = true;
	var tmpMeanLabV = [0,0,0,0];
	for(var i = 1; i < numColors+1; i++){
		kmeansLabV[i*3] = histLabV[kmeans[i]*3];
		kmeansLabV[i*3+1] = histLabV[kmeans[i]*3+1];
		kmeansLabV[i*3+2] = histLabV[kmeans[i]*3+2];
		tmpMeanLabV[i*4] = 0;
		tmpMeanLabV[i*4+1] = 0;
		tmpMeanLabV[i*4+2] = 0;
		tmpMeanLabV[i*4+3] = 0;//pixel count
	}
	var itCount = 0;
	do{
		kmeansConverge = true;
		for(var p = 0; p < 4096; p++){
			if(histN[p]>0){
				var minK = 0;
				var minD = sqr(histLabV[p*3])+sqr(histLabV[p*3+1])+sqr(histLabV[p*3+2]);
				for(var i = 1; i < numColors+1; i++){
					var tmpD = sqr(histLabV[p*3]-kmeansLabV[i*3])+sqr(histLabV[p*3+1]-kmeansLabV[i*3+1])+sqr(histLabV[p*3+2]-kmeansLabV[i*3+2]);
					if(tmpD<minD){
						minD = tmpD;
						minK = i;
					}
				}
				if(minK > 0){
					tmpMeanLabV[minK*4] += histLabV[p*3];
					tmpMeanLabV[minK*4+1] += histLabV[p*3+1];
					tmpMeanLabV[minK*4+2] += histLabV[p*3+2];
					tmpMeanLabV[minK*4+3]++;
				} 
			}
		}
		for(var i = 1; i < numColors+1; i++){
			if(tmpMeanLabV[i*4+3]>0){
				tmpMeanLabV[i*4]/=tmpMeanLabV[i*4+3];
				tmpMeanLabV[i*4+1]/=tmpMeanLabV[i*4+3];
				tmpMeanLabV[i*4+2]/=tmpMeanLabV[i*4+3];
				if(sqr(kmeansLabV[i*3] - tmpMeanLabV[i*4])+sqr(kmeansLabV[i*3+1] - tmpMeanLabV[i*4+1])+sqr(kmeansLabV[i*3+2] - tmpMeanLabV[i*4+2]) > 1){
					kmeansConverge = false;
				}
				kmeansLabV[i*3] = tmpMeanLabV[i*4];
				kmeansLabV[i*3+1] = tmpMeanLabV[i*4+1];
				kmeansLabV[i*3+2] = tmpMeanLabV[i*4+2];
				tmpMeanLabV[i*4] = 0;
				tmpMeanLabV[i*4+1] = 0;
				tmpMeanLabV[i*4+2] = 0;
				tmpMeanLabV[i*4+3] = 0;//pixel count
			}else{
				console.log("exception: no pixel fit in bin "+i);
				$('input[type=number]').get(0).value--;
				recalcPallete();
				return;
			}
		}
		itCount++;
	}while(kmeansConverge != true);
	console.log("iterations until converge = "+itCount);
	//sort according to L value
	for(var i = 1; i < numColors+1; i++){
		var minInd = i, minL = kmeansLabV[i*3];
		for(var j = i+1; j < numColors+1; j++){
			if(kmeansLabV[j*3] < minL){
				minL = kmeansLabV[j*3];
				minInd = j;
			}
		}
		if(minInd != i){
			var tmpLab = [0,0,0];
			tmpLab[0] = kmeansLabV[minInd*3];
			tmpLab[1] = kmeansLabV[minInd*3+1];
			tmpLab[2] = kmeansLabV[minInd*3+2];
			kmeansLabV[minInd*3] = kmeansLabV[i*3];
			kmeansLabV[minInd*3+1] = kmeansLabV[i*3+1];
			kmeansLabV[minInd*3+2] = kmeansLabV[i*3+2];
			kmeansLabV[i*3] = tmpLab[0];
			kmeansLabV[i*3+1] = tmpLab[1];
			kmeansLabV[i*3+2] = tmpLab[2];
		}
	}
	modLabV = kmeansLabV.slice(0);
	//add to html
	for(var i = 1; i < numColors+1; i++){
		var rgb = LAB2RGB(kmeansLabV[i*3],kmeansLabV[i*3+1],kmeansLabV[i*3+2]);
		$('#cs_'+i).css('background-color', 'rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')');
		$('#cs_'+i).css('border-color', 'rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')');
		$('#cs_'+i).click(clickOnColor);
	}
	if(numColors>1) preCalcWeight();
}
function clickOnColor(){
	clickedColorID = $(this).attr('id');
	clickedColorIndex = parseInt(clickedColorID.substring(3));
	demoColorPicker.color.rgbString = $(this).css('background-color');
}
function modColor(){
	var tmpLab = RGB2LAB(demoColorPicker.color.rgb.r,demoColorPicker.color.rgb.g,demoColorPicker.color.rgb.b);
	//constraint Input
	if(tmpLab[0] > modLabV[clickedColorIndex*3]){
		for(var i = clickedColorIndex+1; i < numColors+1; i++){
			if(modLabV[i*3]<tmpLab[0]){
				modLabV[i*3]=tmpLab[0];
				var tmpRgb = LAB2RGB(modLabV[i*3],modLabV[i*3+1],modLabV[i*3+2]);
				$('#cs_'+i).css('background-color', 'rgb('+tmpRgb[0]+','+tmpRgb[1]+','+tmpRgb[2]+')');
			}else break;
		}
	}else{
		for(var i = clickedColorIndex-1; i > 0; i--){
			if(modLabV[i*3]>tmpLab[0]){
				modLabV[i*3]=tmpLab[0];
				var tmpRgb = LAB2RGB(modLabV[i*3],modLabV[i*3+1],modLabV[i*3+2]);
				$('#cs_'+i).css('background-color', 'rgb('+tmpRgb[0]+','+tmpRgb[1]+','+tmpRgb[2]+')');
			}else break;
		}
	}
	modLabV[clickedColorIndex*3] = tmpLab[0];
	modLabV[clickedColorIndex*3+1] = tmpLab[1];
	modLabV[clickedColorIndex*3+2] = tmpLab[2];
	/*real color change here*/
	if(!(imgData)){//not valid, read again?
		var img = document.getElementById('image');
		w = img.width;
		h = img.height;
		//copy image data to canvas
		if(!canvas) canvas = document.getElementById('modImageCanvas');
		canvas.width = w;
		canvas.height = h;
		var ctx = canvas.getContext('2d');
		
		ctx.drawImage(img, 0, 0 );
		try{
			imgData = ctx.getImageData(0, 0, img.width, img.height);
		}catch(err){
			console.log(err.message);
			console.log("getImageData failed, abort modColor");
			return;
		}
	}
	var modImgData = new ImageData(w, h);
	var kmeansL = [0];
	var kmodL = [0];
	for(var i = 1; i < numColors+1; i++){
		kmeansL[i] = kmeansLabV[i*3];
		kmodL[i] = modLabV[i*3];
	}
	kmeansL[numColors+1] = 100;
	kmodL[numColors+1] = 100;
	var R,G,B;
	for(var i = 0; i < h; i++){
		for(var j = 0; j < w; j++){
			R = imgData.data[4*(i*w+j)];
			G = imgData.data[4*(i*w+j)+1];
			B = imgData.data[4*(i*w+j)+2];
			//lightness part
			var oriLAB = RGB2LAB(R,G,B);
			var modL = oriLAB[0];
			for(var k = 0; k < numColors+1; k++){
				if(modL >= kmeansL[k] && modL <= kmeansL[k+1]){
					if(kmeansL[k+1]-kmeansL[k]<0.01){
						modL = kmodL[k];
						break;
					}
					modL = kmodL[k]+(kmodL[k+1]-kmodL[k])*(modL-kmeansL[k])/(kmeansL[k+1]-kmeansL[k]);
					break;
				}
			}
			//colorPart
			var moddedColor;
			var weights;
			if(numColors>1){
				weights = calcWeightPalette(oriLAB);
				var acculmW = 0;
				for(var k = 0; k < numColors; k++){
					weights[k] = (weights[k]<0)? 0:weights[k];
					acculmW += weights[k];
				}
				for(var k = 0; k < numColors; k++){
					weights[k]/=acculmW;
				}	
			}else weights = [1];
			var finalColor = [modL,0,0];
			for(var k = 1; k < numColors+1; k++){
				moddedColor = shiftColor([modL,oriLAB[1],oriLAB[2]], kmeansLabV.slice(k*3, k*3+3),modLabV.slice(k*3, k*3+3));
				//blend according to weight
				finalColor[1] += weights[k-1]*moddedColor[1];
				finalColor[2] += weights[k-1]*moddedColor[2];
			}

			modC = LAB2RGB(modL,finalColor[1],finalColor[2]);
			modImgData.data[4*(i*w+j)] = modC[0];
			modImgData.data[4*(i*w+j)+1] = modC[1];
			modImgData.data[4*(i*w+j)+2] = modC[2];
			modImgData.data[4*(i*w+j)+3] = 255;
		}
	}
	canvas.getContext('2d').putImageData(modImgData,0,0);

}
function calcWeightPalette(lab){
	ret = [];
	for (var j = 1; j < numColors+1; j++) {
		ret.push(calcWeight1(lab, j-1));
	}
	return ret;
}

function calcWeight1(lab, palleteIndex){
	var sum = 0;
	for (var j = 1; j < numColors+1; j++) {
		sum += lambda[j-1][palleteIndex] * phi(Norm2(kmeansLabV.slice(j*3,j*3+3), lab));
	}
	return sum;
}


function preCalcWeight(){ //done once per palette, not on mod color
	sigma = calcSigma();
	lambda = calcLambda();
}
function calcLambda(){
	var s = [];
	var k = numColors + 1;
	for (var p = 1; p < k; p++) {
		var tmp = [];
		for (var q = 1; q < k; q++) {
			tmp.push(phi(Norm2(kmeansLabV.slice(p*3,p*3+3),kmeansLabV.slice(q*3,q*3+3))));
		}
		s.push(tmp);
	}
	return math.inv(s);
}

function calcSigma() {
	var sum = 0;
	for (var i = 1; i < numColors + 1; i++) {
		for (var j = 1; j < numColors + 1; j++) {
			if (i == j) continue;
			sum += Norm2(kmeansLabV.slice(i*3,i*3+3),kmeansLabV.slice(j*3,j*3+3));
		}
	}
	return sum / (numColors*(numColors-1));
}
function phi(r){
	return Math.exp(-r * r / (2 * sigma * sigma));
}

