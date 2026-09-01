
const decvsText =
"attribute vec2 pos;\n" +
"void main() {\n" +
"	gl_Position = vec4(pos, 0.0, 1.0);\n" +
"}\n";

const decfsText = 
"precision highp float;\n" +
"uniform sampler2D txuni;\n" +
"uniform vec2 txsize;\n" +

"void main() {\n" +
"	gl_FragColor = vec4(texture2D(txuni, gl_FragCoord.xy / txsize).xyz - 0.125, 1.0);\n" +
"}\n";

const vecMap = new Float32Array([-1.0, 1.0,  -1.0, -1.0,  1.0, -1.0,  1.0, 1.0]);

// OpenGL context
var gl;

// Shader program and properties
var props;

var codeList = [];
var codesLeft;

function makeShader(src, type) {
	const shader = gl.createShader(type);
	if(shader == null) {
		console.error("Shader creation failed! Wrong shader type?");
		return null;
	}
	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		console.error(log);
		return null;
	}
	return shader;
}

function makeProgram(vs, fs) {
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);

	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(prog);
		console.error(log);
		return null;
	}
	return prog;
}

function genProps() {
	const vs = makeShader(decvsText, gl.VERTEX_SHADER);
	const fs = makeShader(decfsText, gl.FRAGMENT_SHADER);
	const prog = makeProgram(vs, fs);
	
	const vecBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vecMap, gl.STATIC_DRAW);
	
	const decpsHandle = gl.getAttribLocation(prog, "pos");
	const dectxHandle = gl.getUniformLocation(prog, "txuni");
	const decszHandle = gl.getUniformLocation(prog, "txsize");
	
	gl.enableVertexAttribArray(decpsHandle);
	gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
	gl.vertexAttribPointer(decpsHandle, 2, gl.FLOAT, false, 0, 0);
	
	const props = {decProg: prog, vecBuffer: vecBuffer, decpsHandle: decpsHandle, dectxHandle: dectxHandle, decszHandle: decszHandle};
	return props;
}

// "gl" is the context
// "props" is a set of OpenGL indexes
// "img" is an Image
function decrypt(img) {
	// Turn the input HTML element into an OpenGL texture
	gl.activeTexture(gl.TEXTURE0);
	const encodeTex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, encodeTex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
	
	// Create the decrypt framebuffer
	const buffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
	const bufferTex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, bufferTex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, img.naturalWidth, img.naturalHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bufferTex, 0);
	gl.viewport(0, 0, img.naturalWidth, img.naturalHeight);
	console.log(gl.checkFramebufferStatus(gl.FRAMEBUFFER));
	
	gl.clearColor(0, 0, 0, 1); 
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	// Get ready for rendering
	gl.useProgram(props.decProg);
	
	// Load the input image
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, encodeTex);
	gl.uniform1i(props.dectxHandle, 0);
	gl.uniform2f(props.decszHandle, img.width, img.height);
	
	gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	gl.finish();
	console.log(gl.checkFramebufferStatus(gl.FRAMEBUFFER));
	var outData = new Uint8Array(img.naturalWidth * img.naturalHeight * 3 * 3);
	gl.readPixels(0, 0, img.naturalWidth, img.naturalHeight, gl.RGB, gl.UNSIGNED_BYTE, outData);
	return outData;
}

function subsplit(inchars) {
	var outchars = ""
	while(inchars.length > 192) {
		var midchars = inchars.substring(0, 192);
		inchars = inchars.substring(192);
		for(let pos = 0; pos < 96; pos++) {
			outchars += midchars.substring(pos * 6, (pos + 1) * 6) + "_";
		}
		outchars += "\n";
	}
	while(inchars.length > 0) {
		outchars += inchars.substring(0, 6) + "_";
		inchars = inchars.substring(6);
	}
	return outchars;
}

function loadDecrypt() {
	for(const codeEntry of codeList) {
		const codeText = decrypt(codeEntry.img);
		var fmtText = String.fromCharCode(...codeText);
		fmtText = fmtText.replaceAll(/[\x7F-\xFF]/g, "").replaceAll(/[\x00-\x08]/g, "").replaceAll("\t", "   ");
		codeEntry.codeText.textContent = fmtText;
	}
	getASM();
	document.getElementsByTagName("canvas")[0].remove();
}

function decryptAll() {
	const canvas = document.getElementsByTagName("canvas")[0];
	gl = canvas.getContext("webgl");
	props = genProps();
	
	const codes = document.getElementsByClassName("code");
	codesLeft = codes.length;
	for(const code of codes) {
		const img = code.getElementsByTagName("img")[0];
		
		const codeEntry = {img: img, codeText: code.getElementsByTagName("code")[0]};
		codeList.push(codeEntry);
	}
	window.onload = function() { loadDecrypt() };
}

decryptAll();
