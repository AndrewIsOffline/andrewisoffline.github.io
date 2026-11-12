
// Enum for code types
// MUST MATCH the enum in code.cpp!
const CodeType = {
	CPPTYPE: 1,
	JAVATYPE: 2,
	ASMTYPE: 3
};

// Highlighting WASM function
var highlight;

// Memory allocation and freeing functions
var waMalloc, waFree;

// Convenience wrappers for the WASM heap.
var memU8, memU32;

// String-array converters
const decoder = new TextDecoder();
const encoder = new TextEncoder();

// STDOUT and STDERR buffers
var printCharBuffers = [null,[],[]];

// Reads a string from WASM memory
function readString(pos, len = NaN) {
	if(isNaN(len)) {
		// TextDecoders ignore null terminators, so the end of the string has to be
		// found first.
		var subpos = memU8.subarray(pos);
		len = subpos.indexOf(0) - pos + 1;
	}
	var strarr = memU8.subarray(pos, pos + len);
	return decoder.decode(strarr);
}

// Writes a string to WASM memory at the given position
function writeString(pos, str) {
	// Unfortunately, it doesn't look like there's a way to directly copy the input
	// string to the memory buffer. This uses an intermediate buffer.
	var mvarr = encoder.encode(str);
	memU8.set(mvarr, pos);
	memU8.set([0], pos + str.length); // Add null terminator
}

// Writes data to a file (in this case, just text to the console)
// Simplified version of Emscripten's fd_write
var _fd_write = (fd, iov, iovcnt, pnum) => {
	// This seems to work off of an array of structs containing pointers and lengths.
	// The number of characters printed gets written back to pnum.
	var buffer = printCharBuffers[fd];
	if(!buffer) {
		console.log("Sent to null file descriptor!");
		return 0;
	}
	var num = 0;
	for (var i = 0; i < iovcnt; i++) {
		var ptr = memU32[iov >> 2];
		var len = memU32[(iov + 4) >> 2];
		iov += 8;
		for (var j = 0; j < len; j++) {
			var chat = memU8[ptr + j];
			if (chat == 0 || chat == 10) {
				var str = String.fromCharCode.apply(buffer);
				if(fd == 1) {
					console.log(str);
				} else console.error(str);
				buffer.length = 0;
			} else {
				buffer.push(chat);
			}
		}
		num += len;
	}
	memU32.set([num], pnum >> 2);
	return 0;
};

// Aborts the current process
function abort(str) {
	throw new WebAssembly.RuntimeError(str);
}

// Aborts with an error message
// Slightly modified version of Emscripten's code
var ___assert_fail = (condition, filename, line, func) => {
	abort(`Assert failed: ${readString(condition)}, at: ` + [filename ? readString(filename) : 'unknown filename', line, func ? readString(func) : 'unknown function']);
};

// WASM code called abort, so abort
var __abort_js = () => {
	abort("WASM code called abort");
};

// Copies memory between two places in WASM memory
// Copied from Emscripten's generated code
var __emscripten_memcpy_js = (dest, src, num) => memU8.copyWithin(dest, src, src + num);

// Called when WASM is out of memory
// Emscripten likes to allocate a large block of memory for WASM and throw an error if
// that memory runs out. It's pretty easy to add code to expand the heap, but it
// shouldn't need that: if this throws an error, it's because something else is broken.
var _emscripten_resize_heap = () => {
	abort("Ran out of memory!");
}

// Functions that WASM needs
var importObject = {
	env: {
		__assert_fail: ___assert_fail,
		_abort_js: __abort_js,
		_emscripten_memcpy_js: __emscripten_memcpy_js,
		emscripten_resize_heap: _emscripten_resize_heap,
	},
	wasi_snapshot_preview1: {
		fd_write: _fd_write
	},
};

// Uploads the unformatted code to the WASM heap, runs the highlighting script, and
// retrieves the resulting formatted code
function callHighlight(elm, type) {
	var str = elm.textContent;
	var ptr = waMalloc(str.length);
	
	writeString(ptr, str);
	
	var rptr = highlight(ptr, type);
	
	// Get size
	var size = memU8[rptr];
	size |= memU8[rptr + 1] << 8;
	size |= memU8[rptr + 2] << 16;
	size |= memU8[rptr + 3] << 24;
	
	var txt = readString(rptr + 4, size);
	elm.innerHTML = txt;
	
	waFree(ptr);
	waFree(rptr);
}

// Highlights for individual code types
function highlightCPP() {
	var list = document.getElementsByClassName("cpp");
	for(var elm of list) callHighlight(elm, CodeType.CPPTYPE);
}

function highlightJAVA() {
	var list = document.getElementsByClassName("java");
	for(var elm of list) callHighlight(elm, CodeType.JAVATYPE);
}

function highlightASM() {
	var list = document.getElementsByClassName("asm");
	for(var elm of list) callHighlight(elm, CodeType.ASMTYPE);
}

// Runs highlight for all code types
function highlightAll() {
	highlightCPP();
	highlightJAVA();
	highlightASM();
}

// Initialize WASM and run highlighting
function doHighlighting() {
	// Initialize WASM instance
	WebAssembly.instantiateStreaming(fetch("code.wasm"), importObject)
		.then(module => {
			const imports = module.instance.imports;
			const exports = module.instance.exports;
			
			var buffer = exports['memory'].buffer;
			memU8 = new Uint8Array(buffer);
			memU32 = new Uint32Array(buffer);
			exports.emscripten_stack_init();
			exports.__wasm_call_ctors();
			
			// Like with the heap, Emscripten likes to allocate a block of memory for
			// the stack, then throw an error if it gets used up. Unlike the heap,
			// though, Emscripten does the stack check in JS code. Without this, if the
			// stack overflows no error will be thrown, but weird stuff will happen.
			var end = exports.emscripten_stack_get_end();
			if(end < 4) end = 4;
			memU8.set([0x19, 0x28, 0x37, 0x46], end);
			memU32.set([0x55647382], 0);
			
			module['exports'] = exports;
			highlight = exports.highlight;
			waMalloc = exports.waMalloc;
			waFree = exports.waFree;
			highlightAll();
			
			if(memU8[end] != 0x19 || memU8[end + 1] != 0x28 || memU8[end + 2] != 0x37 || memU8[end + 3] != 0x46) {
				console.error("Stack overflow!");
			}
			
			if(memU32[0] != 0x55647382) {
				console.error("SIGSEGV");
			}
		});
}

doHighlighting();
