var weightIsDirty = true;
var numColors;
//array of the weight for each color for each pixel: size is image size * numColors
var pixelPalleteWeight;
//imgData.data => array of the real pixel val of the image: size is image size * 4(rgba)
var imgData;
var w, h;
var kmeansLabV;
var modLabV;
var clickedColorIndex;

function RGB2LAB(r,g,b){
	//algorithm from https://cg2010studio.com/2012/10/02/rgb%E8%88%87cielab%E8%89%B2%E5%BD%A9%E7%A9%BA%E9%96%93%E8%BD%89%E6%8F%9B/
	var lab = [0,0,0];
	var xyz = [0,0,0];
	//rgb to xyz
	xyz[0] = 0.412453*r+0.357580*g+0.180423*b;
	xyz[1] = 0.212671*r+0.715160*g+0.072169*b;
	xyz[2] = 0.019334*r+0.119193*g+0.950227*b;
	for(var i=0; i < 3; i++){
		xyz[i]/=255;
	}
	//xyz to lab
	function f(val){
		return (val>0.008856)? Math.pow(val,1/3):(7.787*val+16/116);
	}
	lab[0] = (xyz[1]>0.008856)? (116*Math.pow(xyz[1],1/3)-16):(903.3*xyz[1]);
	lab[1] = 500*(f(xyz[0]/0.9515)-f(xyz[1]));
	lab[2] = 200*(f(xyz[1])-f(xyz[2]/1.0886));
	return lab;
}
function LAB2RGB(l,a,b){
	var rgb = [0,0,0];
	var xyz = [0,0,0];
	var fxyz = [0,0,0];
	fxyz[1] = (l+16)/116;
	fxyz[0] = fxyz[1]+(a/500);
	fxyz[2] = fxyz[1]-(b/200);
	xyz[0] = (fxyz[0]>0.008856)? (0.9515*Math.pow(fxyz[0],3)):((fxyz[0]-16)/116*0.000235764675*0.9515);
	xyz[1] = (fxyz[1]>0.008856)? (Math.pow(fxyz[1],3)):((fxyz[1]-16)/116*0.000235764675);
	xyz[2] = (fxyz[2]>0.008856)? (1.0886*Math.pow(fxyz[2],3)):((fxyz[2]-16)/116*0.000235764675*1.0886);
	//xyz to rgb
	rgb[0] = Math.floor((3.24079*xyz[0]-1.53715*xyz[1]-0.498535*xyz[2])*255);
	rgb[1] = Math.floor((-0.969256*xyz[0]+1.875992*xyz[1]+0.041556*xyz[2])*255);
	rgb[2] = Math.floor((0.055648*xyz[0]-0.204043*xyz[1]+1.057311*xyz[2])*255);
	return rgb;
}
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
function sqr(x){return x*x;}
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
	var canvas = document.createElement('canvas');
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
	
	weightIsDirty = true;
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
			}
		}
		itCount++;
	}while(kmeansConverge != true)
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
}
function clickOnColor(){
	clickedColorID = $(this).attr('id');
	demoColorPicker.color.rgbString = $(this).css('background-color');
	clickedColorIndex = parseInt(clickedColorID.substring(3));
}
function modColor(){
	if(weightIsDirty) calcWeight();
	weightIsDirty = false;
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
}

function calcWeight(){

}


