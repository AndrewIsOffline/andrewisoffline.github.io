// Highlighting rules
const CPPTYPES = ["bool", "int", "char", "short", "void", "signed", "unsigned", "long", "wchar_t", "char16_t", "char32_t", "char8_t", "float", "double"];
const CPPFTNS = ["if", "else", "while", "do", "for", "switch", "case", "default", "goto", "return", "break", "continue", "try", "catch", "throw"];
const CPPOTRS = ["asm", "class", "const", "extern", "false", "inline", "new", "private", "protected", "public", "sizeof", "static", "this", "true", "using"];
const CPPCMT = "//";

const JAVATYPES = ["boolean", "byte", "char", "double", "float", "int", "long", "short", "void"];
const JAVAFTNS = ["if", "else", "while", "do", "for", "switch", "case", "default", "goto", "return", "break", "continue", "try", "catch", "throw", "finally"];
const JAVAOTRS = ["abstract", "assert", "class", "const", "enum", "extends", "false", "final", "implements", "import", "instanceof", "interface", "native", "new", "null", "package", "private", "protected", "public", "return", "static", "strictfp", "super", "synchronized", "throws", "transient", "true", "volatile"];
const JAVACMT = "//";

const ASMTYPES = [".db", ".dw"];
const ASMFTNS = ["adc", "add", "and", "bit", "call", "cp", "dec", "ei", "ex", "inc", "jp", "ld", "pop", "push", "sla", "sbc", "set", "sub", "res", "ret", "rl", "rst", "xor"];
const ASMOTRS = [".org", "#define", "#include"];
const ASMCMT = ";";

/*
 * highlight - Adds highlighting to code blocks
 * Parameters: The HTML element to highlight and the language rule set name
 * Behavior: Adds HTML elements to highlight the text in the given element
 */
function highlight(elmt, type) {
	var types, ftns, otrs, cmt;
	
	switch(type) {
		case "cpp":
			types = CPPTYPES;
			ftns = CPPFTNS;
			otrs = CPPOTRS;
			cmt = CPPCMT;
			break;
		case "java":
			types = JAVATYPES;
			ftns = JAVAFTNS;
			otrs = JAVAOTRS;
			cmt = JAVACMT;
			break;
		case "asm":
			types = ASMTYPES;
			ftns = ASMFTNS;
			otrs = ASMOTRS;
			cmt = ASMCMT;
			break;
		default:
			return;
	}
	
	var text = elmt.textContent
	var out = "";
	var lines = text.split("\n");
	
	for(var line of lines) {
		var cmtpos = line.indexOf(cmt);
		var fpos = 0, bpos = 0;
		var scanning = true;
		while(scanning) {
			var found = false;
			var quot = false;
			var chat;
			// Separate words
			wdloop: while(scanning && !found) {
				if(bpos == line.length || bpos == cmtpos) {
					scanning = false;
					chat = '';
					break wdloop;
				}
				chat = line.charAt(bpos);
				if(chat < '#' || chat == '|' || chat == '/' || chat == '{' || chat == '}' || chat == '[' || chat == ']' || (chat >= '%' && chat <= '-') || (chat >= ':' && chat <= '?')) {
					found = true;
					if(chat == '\'' || chat == '\"') quot = true;
					if(chat == '<') chat = "&lt;";
					if(chat == '>') chat = "&gt;";
					break wdloop;
				}
				bpos++;
			}
			// Found a word, check if it's reserved
			if(bpos != fpos) {
				if(isNum(line.substring(fpos, bpos))) {
					out += "<span style=color:chocolate>" + line.substring(fpos, bpos) + "</span>";
				} else {
					var word = line.substring(fpos, bpos);
					found = false;
					for(var comp of types) {
						if(word == comp) {
							found = true;
							out += "<span class=\"ctype\">" + word + "</span>";
							break;
						}
					}

					if(!found) {
						for(comp of ftns) {
							if(word == comp) {
								found = true;
								out += "<span class=\"cfunction\">" + word + "</span>";
								break;
							}
						}

						if(!found) {
							for(comp of otrs) {
								if(word == comp) {
									found = true;
									out += "<span class=\"cother\">" + word + "</span>";
									break;
								}
							}
							if(!found) {
								out += word;
							}
						}
					}
				}
			}
			
			// Handle quotation marks
			if(quot) {
				fpos = bpos;
				var chat2 = " ";
				while(chat2 != chat) {
					bpos++;
					chat2 = line.charAt(bpos);
					if(chat2 == "\\") bpos++;
				}
				bpos++;
				out += "<span class=\"cquote\">" + line.substring(fpos, bpos) + "</span>";
				fpos = bpos;
			} else {
				out += chat;
				bpos++;
				fpos = bpos;
			}
		}
		// Handle comments
		if(cmtpos != -1) {
			out += "<span class=\"ccomment\">" + line.substring(cmtpos) + "</span>"
		}
	}
	elmt.innerHTML = out;
}

/*
 * isNum - Checks for numbers
 * Parameters: A string
 * Output: True if the input is a number, false otherwise
 */
function isNum(str) {
	// It looks like this is how IDEs do it, and anyways if there's a problem, it's with
	// the input.
	let ch = str.charAt(0);
	if(ch < '0' || ch > '9') return false;
	return true;
}

/*
 * getCPP - Process C++ code blocks
 */
function getCPP() {
	var list = document.getElementsByClassName("cpp");
	for(var elm of list) highlight(elm, "cpp");
}

/*
 * getJAVA - Process Java code blocks
 */
function getJAVA() {
	var list = document.getElementsByClassName("java");
	for(var elm of list) highlight(elm, "java");
}

/*
 * getASM - Process Z80 Assembly code blocks
 */
function getASM() {
	var list = document.getElementsByClassName("asm");
	for(var elm of list) highlight(elm, "asm");
}

/*
 * getALL - Process all code blocks
 */
function getALL() {
	getCPP();
	getJAVA();
	getASM();
}
