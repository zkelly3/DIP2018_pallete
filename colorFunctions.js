function sqr(x){return x*x;}
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
function inGamut(lab){
	rgb = LAB2RGB(lab[0],lab[1],lab[2]);
	return rgb[0]>=0&&rgb[0]<=255&&rgb[1]>=0&&rgb[1]<=255&&rgb[2]>=0&&rgb[2]<=255;
}
function Norm1(c1,c2){
	return Math.abs(c1[0]-c2[0])+Math.abs(c1[1]-c2[1])+Math.abs(c1[2]-c2[2]);
}
function Norm2(c1,c2){
	return Math.sqrt(sqr(c1[0]-c2[0])+sqr(c1[1]-c2[1])+sqr(c1[2]-c2[2]));
}
function extendOutOfGamut(lab1,lab2){
	var l = Norm2(lab1,lab2);
	var mul = 1;
	if(l<0.001){console.log('lab1,lab2 too close'); return;}
	else if(l<20) mul = 20/l;
	var vec = [(lab2[0]-lab1[0])*mul, (lab2[1]-lab1[1])*mul, (lab2[2]-lab1[2])*mul];
	var ret = [lab2[0]+vec[0], lab2[1]+vec[1], lab2[2]+vec[2]];
	do{
		ret = [ret[0]+vec[0], ret[1]+vec[1], ret[2]+vec[2]];
	}while(inGamut(ret));
	return ret;
}
function intersectGamut(lab1,lab2){
	var mid, inC, outC, tmp, isExtend;
	if(inGamut(lab2)){
		inC = lab2.slice(0);
		outC = extendOutOfGamut(lab1,lab2);
		if(!outC) return lab2;
		mid = [(inC[0]+outC[0])/2, (inC[1]+outC[1])/2, (inC[2]+outC[2])/2];
	}else{
		mid = [(lab1[0]+lab2[0])/2, (lab1[1]+lab2[1])/2, (lab1[2]+lab2[2])/2];
		if(inGamut(mid)){
			inC = mid.slice(0); outC = lab2.slice(0);
		}else{
			inC = lab1.slice(0); outC = mid.slice(0);
		}
	}
	while(Norm1(inC,outC)>2.3){
		mid = [(inC[0]+outC[0])/2, (inC[1]+outC[1])/2, (inC[2]+outC[2])/2];
		if(inGamut(mid)){
			inC = mid.slice(0);
		}else{
			outC = mid.slice(0);
		}
	}
	return inC;
}
function shiftColor(labTarget, lab1, lab2){
	if(Norm1(lab1,lab2)<2.3/*no shift*/) return labTarget;
	if(Norm1(labTarget,lab1)<2.3) return lab2;
	/*to be implemented*/
	var vec = [lab2[0]-lab1[0], lab2[1]-lab1[1], lab2[2]-lab1[2]];
	var x0 = [labTarget[0]+vec[0], labTarget[1]+vec[1], labTarget[2]+vec[2]];
	var xb;
	if(inGamut(x0)){
		xb = intersectGamut(labTarget, x0);
	}else{
		xb = intersectGamut(lab2, x0);
	}
	var cb = intersectGamut(lab1, lab2); //maybe store this?
	var tmp = Norm2(xb,labTarget)/Norm2(cb,lab1);
	tmp = ((tmp<1)? tmp:1)*Norm2(lab2,lab1)/Norm2(xb,labTarget);
	return [labTarget[0]+(xb[0]-labTarget[0])*tmp,labTarget[1]+(xb[1]-labTarget[1])*tmp,labTarget[2]+(xb[2]-labTarget[2])*tmp];
}




