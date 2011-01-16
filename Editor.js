var LightEditor;
(function(){
	var instances = [];
	LightEditor = function(args){
		var n = args.node, c;
		this.scrollMode = args.scrollMode || "scroll";
		(this.domNode = document.createElement("div")).className = "LightEditor";
		(this.containerNode = (typeof n === "string" && (n = document.getElementById(n)))).className += "LightEditorContainer";
		this.domNode.innerHTML = n.innerHTML;
		n.innerHTML = "";
		n.appendChild(this.domNode);

		this.domNode.appendChild(this.caret = c = this.createCaret());

		this.registerPlugins();
		this.connectEvents();
		LightEditor.Keyboard.registerObserver(this);
		instances[instances.length] = this;
		this.getComputedStyle();
		this.setDimensions();
	};
	LightEditor.prototype = {
		/**
		 * @description If true, the first char will be uppercase
		 * @type {boolean}
		 */
		_upperCase: false,
		/**
		 * @description Contains the intervalId for the blink
		 * @Type {number}
		 * */
		_blink: 0,
		/**
		 * @description Contains the modifiers to add after the next keystroke
		 * @type {Array}
		 */
		_modifiers: [],
		/**
		 * @description timeoutId for the autoscroll
		 * @type {number}
		 */
		_autoscrollTimeout: null,
		/**
		 * @description Interval for the caret blink
		 * @type {number}
		 */
		blinkInterval: 500,
		/**
		 * @description Active plugins for this editor instance
		 * @type {Array}
		 */
		plugins: [],
		/**
		 * @description Node containing the editable text
		 * @type {Node}
		 */
		domNode: null,
		/**
		 * @description The caret node
		 * @type {Node}
		 */
		caret: null,
		/**
		 * @description true when the current editor is focused
		 * @type {boolean}
		 */
		focused: false,
		/**
		 * @description Editor width
		 * @type {number}
		 */
		width: 0,
		/**
		 * @description Editor height
		 * @type {number}
		 */
		height: 0,
		/**
		 * @description Scroll mode: "scroll" or "autoexpand".
		 * @default "scroll"
		 * @type {String}
		 */
		scrollMode: "scroll",
		/**
		 * @description When a finger is near the editor border, the text is scrolled in that direction after
		 * autoscrollDelay ms
		 * @type {number}
		 */
		autoscrollDelay: 1000,
		/**
		 * @description Interval for the scroll animation (ms)
		 * @type {number}
		 */
		viewportMoveTime: 50,
		/**
		 * @description intervalId for the scroll animation
		 * @type {number}
		 */
		viewportMoveInterval: null,
		/**
		 * @description The domNode.parentNode
		 * @type {Node}
		 */
		containerNode: null,
		/**
		 * @description Contains the mapping for the supported text modifiers
		 * @type {Object}
		 */
		modifiersMap: {
			B:{
				tagName: "span",
				style:{
					fontWeight: "bold"
				}
			},
			I:{
				tagName: "span",
				style:{
					fontStyle: "italic"
				}
			},
			U:{
				tagName: "span",
				style:{
					textDecoration: "underline"
				}
			}
		},
		/**
		 * @description Registers the plugins passed as space separated list in the plugins attribute
		 */
		registerPlugins: function(){
			this.plugins = [];
			var plugins = this.containerNode.getAttribute("data-plugins").replace(/\s/g, "").split(","),
				availablePlugins = LightEditor.plugins
			;
			for(var i = 0, l = plugins.length; i < l; i++){
				this.plugins[i] = new availablePlugins[plugins[i]]({ editor: this });
			}
		},
		/**
		 * @description Sets the domNode height
		 */
		setDimensions: function(){
			var i = this.plugins.length, cumulativeHeight = parseInt(window.getComputedStyle(this.domNode.parentNode, null).getPropertyValue("height"));
			while(i--){
				if(this.plugins[i].hasLayout){
					cumulativeHeight -= this.plugins[i].getHeight();
				}
			}
			this.domNode.style.height = cumulativeHeight + "px";
		},
		/**
		 * @description Returns the domNode
		 * @return The editor domNode
		 */
		getDomNode: function(){
			return this.domNode;
		},
		/**
		 * @description Returns the containerNode
		 * @return The editor containerNode
		 */
		getContainerNode: function(){
			return this.containerNode;
		},
		/**
		 * @description Creates the caret node
		 * @return the caret node
		 */
		createCaret: function(){
			var c = document.createElement("span");
			c.className = "caret";
			return c;
		},
		/**
		 * @description Creates and connects the event handlers
		 */
		connectEvents: function(){
			var n = this.domNode, self = this;
			n.addEventListener("touchmove", function(){ self.onTouchMove.apply(self, arguments) }, false);
			n.addEventListener("touchstart", function(){ self.onTouchMove.apply(self, arguments) }, false);
			n.addEventListener("touchstart", function(evt){
				self.stopViewportTimeout.apply(self, arguments);
				self._autoscrollTimeout = setTimeout(function(){ self.startViewportTimeout.call(self, evt) }, self.autoscrollDelay);
			}, false);
			n.addEventListener("touchend", function(){
				self.stopViewportTimeout.apply(self, arguments)
			}, false);
			n.addEventListener("touchstart", function(){
				if(self.focused){
					return;
				}
				self.onFocus.apply(self, arguments);
			}, false);
			document.addEventListener("touchstart", function(e){
				if(e.target !== n){
					self.onBlur.apply(self, arguments);
				}
			}, false);

		},
		/**
		 * @description Computes height and width for this editor
		 */
		getComputedStyle: function(){
			var s = window.getComputedStyle(this.domNode, null);
			this.height = parseInt(s.getPropertyValue("height"));
			this.width = parseInt(s.getPropertyValue("width"));
		},
		/**
		 * @description Notifies this editor about a topic
		 * @param {String} topic
		 * @param {Array} args
		 */
		notify: function(topic, args){
			if(!this.focused){
				return;
			}
			switch(topic){
				case "KeyPress":
					var data = args[0], type = args[1], active = args[2];
					switch(type){
						case "":
							data && this.write(data);
						break;
						case "meta":
							this.handleMeta(data);
						break;
						case "modifier":
							this.handleModifier(data, active);
						break;
						default:
						break;
					}

				break;
				default:
				break;
			}
		},
		/**
		 * @description Returns the previous or the next textNode
		 * @param {Node} n
		 * @param {String} pos "next" or "previous"
		 * @return The previous or the next textNode, or null
		 */
		getRelativeTextNode: function(n, pos){
			var sibling = {
				previous: "previousSibling",
				next: "nextSibling"
				}[pos],
					child = {
						previous: "lastChild",
						next: "firstChild"
					}[pos]
			;
			if(n[sibling]){
				if(n[sibling].nodeType === 3){
					return n[sibling];
				}else{
					n = n[sibling][child];
					while(n && n.nodeType != 3){
						n = n[child];
					}
					return n; // node or null
				}
			}else{
				return n.parentNode === this.domNode ? null : this.getRelativeTextNode(n.parentNode, pos);
			}
		},
		/**
		 * @description Returns the next textNode
		 * @param {Node} n
		 * @return The next textNode, or null
		 */
		getNextTextNode: function(n){
			return this.getRelativeTextNode(n, "next");
		},
		/**
		 * @description Returns the previous textNode
		 * @param {Node} n
		 * @return The next previousNode, or null
		 */
		getPreviousTextNode: function(n){
			return this.getRelativeTextNode(n, "previous");
		},
		/**
		 * @description Returns the previous textNode or the previous EOL node
		 * @param {Node} n
		 * @return A node or null
		 */
		getPreviousValidNode: function(n){
			var
				validNode = null,
				vnode = null,
				isEOL = this.isEOL, isTextNode = this.isTextNode,
				nodeIterator = document.createNodeIterator(
					this.domNode,
					NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT,
					{ acceptNode: function(node){
						if(!!(node.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && (isEOL(node) || isTextNode(node))){
							return NodeFilter.FILTER_ACCEPT;
						}else{
							return NodeFilter.FILTER_REJECT;
						}
					}},
					false
				);
			while(vnode = nodeIterator.nextNode()){
				if(!!(vnode.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && (isEOL(vnode) || isTextNode(vnode))){
					validNode = vnode;
				}
			}
			return validNode;
		},
		/**
		 * @description Adds or remove modifier to/from the current queue
		 * @param {String} data (eg "B", "I"...)
		 * @param {boolean} active
		 */
		handleModifier: function(data, active){
			var _modifiers = this._modifiers;
			if(active){
				_modifiers[_modifiers.length] = data;
			}else{
				var i = _modifiers.length;
				while(i--){
					if(_modifiers[i] === data){
						_modifiers.splice(i, 1);
						break;
					}
				}
				this.removeModifier(data);
			}
			switch(data){
				case "left-shift":
				case "right-shift":
					this._upperCase = !this._upperCase;
				break;
				default:
				break;
			}
		},
		/**
		 * @description Removes a modifier from the nodes surrounding the caret
		 * @param {String} data
		 */
		removeModifier: function(data){
			var c = this.caret, node = c.parentNode, domNode = this.domNode, found = false, matches, counter,
				currentModifier = this.modifiersMap[data]
			;
			if(!node || !currentModifier){
				// for example, pressing SHIFT
				return;
			}
			while(node && node != domNode && !found){
				counter = matches = 0;
				for(var j in currentModifier.style){
					counter++;
					if(node.style[j] === currentModifier.style[j]){
						matches++;
					}
				}
				if(node.tagName.toLowerCase() === currentModifier.tagName && counter === matches){
					found = true;
					this.unwrap(node);
				}
				node && (node = node.parentNode);
			}
		},
		/**
		 * @description Removes a wrapper from a node
		 * @param {Node} node
		 */
		unwrap: function(node){
			for(var i = 0, l = node.childNodes.length; i < l; i++){
				node.parentNode.insertBefore(node.firstChild, node);
			}
			node.parentNode.removeChild(node);
		},
		/**
		 * @description Remove nodes without children
		 */
		removeEmptyNodes: function(){
			var nodes, node, domNode = this.domNode, i, c = this.caret;
			while((nodes = domNode.querySelectorAll("*:empty")).length > 1){
				i = nodes.length;
				while(i--){
					node = nodes[i];
					(node != c) && (node.parentNode.removeChild(node));
				}
			}
		},
		/**
		 * @description Remove empty nodes from the document
		 */
		normalizeDocument: function(){
//			var nodes, node, i, domNode = this.domNode, N = 0;
			this.removeEmptyNodes();
//			while((nodes = domNode.querySelectorAll("br:only-child")).length - N){
//
//				for(i = nodes.length; i--;){
//					node = nodes[i];
//					if(node.parentNode.childNodes.length === 1){
//						node.parentNode.parentNode.replaceChild(document.createElement("br"), node.parentNode);
//					}else{
//						N++;
//					}
//				}
//			}
		},
		/**
		 * @description Handles the meta keys, eg the .?123 and ABC on the keyboard
		 * @param {String} data
		 */
		handleMeta: function(data){
			var c = this.caret, deltaY = 0, caretHeight, eols, lastEOL, domNode = this.domNode, cstyle, ofs = 0, pn;
			switch(data){
				case "backspace":
					var validNode = this.getPreviousValidNode(c), d;
					if(this.isTextNode(validNode)){
						d = validNode.data;
						validNode.data = d.substring(0, d.length-1);
						pn = validNode.parentNode;
						validNode.parentNode.normalize();
					}else if(this.isEOL(validNode)){
						validNode.parentNode.removeChild(validNode);
					}
					// TODO: normalize a subnode, if possible
					this.domNode.normalize();
				break;
				case "enter":
					c.parentNode.insertBefore(this.createEOL(), c);
					this.showCaret();
					if(this.scrollMode === "scroll"){
						// scroll
						caretHeight = parseInt(window.getComputedStyle(c, null).getPropertyValue("font-size"));
						if((deltaY = c.offsetTop - this.height) > 0){
							this.domNode.scrollTop = deltaY + caretHeight;
						}
					}else{
						// autoExpand
						eols = this.getEOLs();
						lastEOL = eols[eols.length-1];
						cstyle = window.getComputedStyle(lastEOL, false);
						ofs = this.computeOffsetTop(lastEOL);
						domNode.style.height = this.height + lastEOL.offsetTop + parseInt(cstyle.getPropertyValue("height")) + "px";
					}
					domNode.scrollLeft = 0;
				break;
				case "hidekbd":
					this.blurAllInstances();
					this.hideKeyboard();
				break;
				default:
				break;
			}
		},
		/**
		 * @description Returns the html contained in this editor
		 * @return {String} the html contained in this editor
		 */
		getContent: function(){
			return this.domNode.innerHTML;
		},
		/**
		 * @description Removes the focus from all the instances
		 */
		blurAllInstances: function(){
			var i = instances.length;
			while(i--){
				instances[i].blur();
			}
		},
		/**
		 * @description Creates a End Of Line node
		 * @return {Node}
		 */
		createEOL: function(){
			var EOL;
			(EOL = document.createElement("span")).appendChild(document.createTextNode("\n"));
			EOL.className = "EOL";
			return EOL;
		},
		/**
		 * @description True if node is EOL
		 * @param {Node} node
		 * @return {boolean} True if the node is a EOL, false otherwise
		 */
		isEOL: function(node){
			if(!node){
				return false;
			}
			var tagName, child;
			return !!((tagName = node.tagName) && tagName.toLowerCase() === "span" && (child = node.firstChild) &&
				child.nodeType === 3 && child.data.charCodeAt(0)  === 10);
		},
		/**
		 * @description True if node is a text node
		 * @param node
		 * @return True if node is a text node, false otherwise
		 */
		isTextNode: function(node){
			if(!node){
				return false;
			}
			return node.nodeType === 3;
		},
		/**
		 * @description Writes a character
		 * @param {String} chr
		 */
		write: function(chr){
			var c = this.caret,
				ps = c.previousSibling,
				tn = this.getPreviousTextNode(c),
				deltaX = 0,
				_modifiers = this._modifiers,
				node, modifiersMap = this.modifiersMap,
				currentModifier,
				prevNode, st, nodeStyle
			;
			this._upperCase && (chr = chr.toUpperCase());
			if(tn && !this.isEOL(ps) && !_modifiers.length){
				tn.data = tn.data + chr;
				this.showCaret();
			}else{
				node = document.createTextNode(chr);
				for(var i = _modifiers.length; i--;){
					prevNode = node;
					currentModifier = modifiersMap[_modifiers[i]];
					if(!currentModifier){
						// left and right shift
						break;
					}
					node = document.createElement(currentModifier.tagName), nodeStyle = node.style;
					st = currentModifier.style;
					for(var j in st){
						nodeStyle[j] = st[j];
					}
					node.appendChild(prevNode);
				}
				_modifiers.length = 0;
				c.parentNode.insertBefore(node, c);
			}
			LightEditor.Keyboard.setKeyActive("left-shift", false);
			LightEditor.Keyboard.setKeyActive("right-shift", false);
			this._upperCase = false;
			this.getModifiersFromCaret();
			c.style.display = "inline";
			if((deltaX = this.computeOffsetLeft(c) - this.width)>0){
				this.domNode.scrollLeft = deltaX;
			}
		},
		/**
		 * @description Finds the modifiers around the caret and notifies the plugins
		 */
		getModifiersFromCaret: function(){
			var domNode = this.domNode, pvn = this.getPreviousValidNode(this.caret);
			if(!pvn){
				return;
			}
			var node = pvn.parentNode,
				modifiersMap = this.modifiersMap, currentModifier, matches, c
			;
			for(var i in modifiersMap){
				this.notifyModifiers(i, false);
			}
			while(node != domNode){
				for(i in modifiersMap){
					matches = c = 0;
					currentModifier = modifiersMap[i];
					for(var j in currentModifier.style){
						c++;
						if(node.style[j] === currentModifier.style[j]){
							matches++;
						}
					}
					if(matches === c && node.tagName.toLowerCase() === currentModifier.tagName){
						this.notifyModifiers(i, true, currentModifier.group);
					}
				}
				node = node.parentNode;
			}
		},
		/**
		 * @description Notifies all subscribed plugins about the modifiers around the caret
		 */
		notifyModifiers: function(){
			var plugins = this.plugins, i = plugins.length, h;
			while(i--){
				if(h = plugins[i].subscriptions.notifyModifiers){
					plugins[i][h].apply(plugins[i], arguments);
				}
			}
		},
		/**
		 * @description Computes the left/top offsets
		 * @param {Node} node
		 * @param {String} which "top" or "left"
		 */
		computeOffset: function(node, which){
			var ofs = 0, w = "offset" + which;
			do{
				ofs += node[w];
			}while(node = node.offsetParent); // thanks ppk!
			return ofs;
		},
		/**
		 * @description Computes the top offset
		 * @param {Node} node
		 */
		computeOffsetTop: function(node){
			return this.computeOffset(node, "Top");
		},
		/**
		 * @description Computes the left offset
		 * @param {Node} node
		 */
		computeOffsetLeft: function(node){
			return this.computeOffset(node, "Left");
		},
		/**
		 * @description moves the caret in the given position
		 * @param {number} x
		 * @param {number} y
		 */
		moveCaret: function(x, y){
			var c = this.caret, t = document.elementFromPoint(x, y), cn = t.childNodes, i, l, j, m, tn,
				curNode, minNode, testNode = document.createElement("span"), dx = window.screen.width, curX, abs = Math.abs,
				delta, currentChild, index = 0, scrollLeft = this.domNode.scrollLeft
			;
			testNode.style.position = "absolute";
			// I need cn.length here, not a static var
			for(i = 0; i < cn.length; i++){
				// de-normalize
				tn = cn[i];
				if(tn.nodeType === 3){
					for(j = 0, m = tn.textContent.length; j < m; j++){
						tn.splitText(1);
						tn = tn.nextSibling;
					}
				}
			}
			for(i = 0, l = cn.length; i <= l; i++){
				currentChild = cn[i], curX = 0;
				currentChild ? t.insertBefore(testNode, currentChild) : t.appendChild(testNode);
				curNode = testNode;
				do{
					curX += curNode.offsetLeft;
				}while(curNode = curNode.offsetParent);
				if((delta = abs(curX-x-scrollLeft)) < dx && testNode != c && testNode.firstChild != c && testNode.parentNode != c){
					dx = delta;
					index = i;
				}
				testNode.parentNode && t.removeChild(testNode);
			}
			if(index < l){
				minNode = cn[index];
				minNode && minNode != c && minNode != c.firstChild && t.insertBefore(c, minNode);
			}else{
				c != t && t.appendChild(c);
			}
			t.normalize();
			this.getModifiersFromCaret();
		},
		/**
		 * @description Starts the viewport animation timeout
		 * @param {Event} evt
		 */
		startViewportTimeout: function(evt){
			var self = this;
			this.viewportMoveInterval = setInterval(function(){ self.adjustViewport(evt) }, this.viewportMoveTime);
		},
		/**
		 * @description Stops the viewport animation timeout
		 */
		stopViewportTimeout: function(){
			this._autoscrollTimeout && clearTimeout(this._autoscrollTimeout);
			this._autoscrollTimeout = null;
			this.viewportMoveInterval && clearInterval(this.viewportMoveInterval);
			this.viewportMoveInterval = null;
		},
		/**
		 * @description Changes the viewport scroll
		 * @param {Event} evt
		 */
		adjustViewport: function(evt){
			var tt = evt.targetTouches[0], x = tt.clientX, y = tt.clientY, domNode = this.domNode,
				oT = domNode.offsetTop, oL = domNode.offsetLeft
			;
			if(y - oT < 20){
				domNode.scrollTop -= 10;
			}else if(y - oT > this.height - 20){
				domNode.scrollTop += 10;
			}
			if(x - oL < 20){
				domNode.scrollLeft -= 10;
			}else if(x - oL > this.width - 20){
				domNode.scrollLeft += 10;
			}
		},
		/**
		 * @description Returns the EOLs
		 * @returns {NodeList} EOLs
		 */
		getEOLs: function(){
			return this.domNode.querySelectorAll("span.EOL");
		},
		/**
		 * @description Handler for the touchMove event: moves the caret
		 * @param {Event} evt
		 */
		onTouchMove: function(evt){
			// touch
			var trg = evt.target, tt = evt.targetTouches[0], domNode = this.domNode, x = tt.clientX, y = tt.clientY, lines,
					line, curY = 0, deltaY = this.height,
				abs = Math.abs, minNode, c = this.caret, scrollTop = domNode.scrollTop, curNode
			;
			if(trg === domNode){
				lines = this.getEOLs();
				lines.length && (minNode = lines[0]);
				for(var i = 0, l = lines.length; i < l; i++){
					line = lines[i];
					curNode = line;
					curY = 0;
					do{
						curY += curNode.offsetTop;
					}while(curNode = curNode.offsetParent);
					if(abs(curY - y - scrollTop) < abs(deltaY) ){
						minNode = line;
						deltaY = curY - y - scrollTop;
					}
				}
				minNode && minNode.parentNode.insertBefore(c, minNode);
			}else{
				this.moveCaret(x, y);
			}
			evt.preventDefault();
			evt.stopPropagation();
		},
		/**
		 * @description Make the caret blinking
		 */
		blinkCaret: function(){
			this.caret.style.display = this.caret.style.display === "inline" ? "none" : "inline";
		},
		/**
		 * @description Shows the caret
		 */
		showCaret: function(){
			var self = this;
			this._blink && clearInterval(this._blink);
			this._blink = setInterval(function(){ self.blinkCaret() }, this.blinkInterval);
		},
		/**
		 * @description Hides the caret
		 */
		hideCaret: function(){
			clearInterval(this._blink);
			this._blink = 0;
			this.caret.style.display = "none";
		},
		/**
		 * @description Removes the focus from this editor
		 */
		blur: function(){
			this.domNode.blur();
			this.onBlur();
		},
		/**
		 * @description onBlur handler
		 */
		onBlur: function(){
			var dn = this.domNode;
			this.focused = false;
			dn.className = dn.className.replace(" focused", "");
			this.hideKeyboard();
			this.hideCaret();
		},
		/**
		 * @description onFocus handler
		 */
		onFocus: function(){
			var dn = this.domNode;
			this.blurAllInstances();
			this.focused = true;
			this.showKeyboard();
			this.showCaret();
			dn.className = dn.className.replace(" focused", "") + " focused";
		},
		/**
		 * @description Hides the keyboard
		 */
		hideKeyboard: function(){
			LightEditor.Keyboard.hide();
		},
		/**
		 * @description Shows the keyboard
		 */
		showKeyboard: function(){
			LightEditor.Keyboard.show();
		}
	};
	LightEditor.plugins = {};
})();