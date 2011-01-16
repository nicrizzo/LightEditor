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
		_blink: 0,
		_modifiers: [],
		_viewportTimeout: null,
		blinkInterval: 500,
		plugins: [],
		dispatcher: {},
		domNode: null,
		caret: null,
		focused: false,
		width: 0,
		height: 0,
		/**
		 * @type {boolean}
		 */
		_upperCase: false,
		/**
		 * @type {LightEditor.plugins.Toolbar}
		 */
		toolbar: null,
		// scroll | autoexpand
		scrollMode: "scroll",
		autoscrollDelay: 1000,
		autoscrollTimeout: null,
		viewportMoveTime: 50,
		viewportMoveInterval: null,
		containerNode: null,
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
		 *
		 * @param {Object} observer
		 */
		registerObserver: function(observer){},
		removeObserver: function(topic, observer, method){},
		setDimensions: function(){
			var i = this.plugins.length, cumulativeHeight = parseInt(window.getComputedStyle(this.domNode.parentNode, null).getPropertyValue("height"));

			while(i--){
				if(this.plugins[i].hasLayout){
					cumulativeHeight -= this.plugins[i].getHeight();
				}
			}
			this.domNode.style.height = cumulativeHeight + "px";
		},
		getDomNode: function(){
			return this.domNode;
		},
		getContainerNode: function(){
			return this.containerNode;
		},
		createCaret: function(){
			var c = document.createElement("span");
			c.className = "caret";
			return c;
		},
		connectEvents: function(){
			var n = this.domNode, self = this;
			n.addEventListener("touchmove", function(){ self.onTouchMove.apply(self, arguments) }, false);
			n.addEventListener("touchstart", function(){ self.onTouchMove.apply(self, arguments) }, false);
			n.addEventListener("touchstart", function(evt){
				self.stopViewportTimeout.apply(self, arguments);
				self.autoscrollTimeout = setTimeout(function(){ self.startViewportTimeout.call(self, evt) }, self.autoscrollDelay);
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
		getComputedStyle: function(){
			var s = window.getComputedStyle(this.domNode, null);
			this.height = parseInt(s.getPropertyValue("height"));
			this.width = parseInt(s.getPropertyValue("width"));
		},
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
		 *
		 * @param {Node} n
		 * @param {String} pos
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
		getNextTextNode: function(n){
			return this.getRelativeTextNode(n, "next");
		},
		getPreviousTextNode: function(n){
			return this.getRelativeTextNode(n, "previous");
		},
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
		getNextValidNode: function(n){
			return this.getRelativeTextNode(n, "next");
		},
//		getPreviousValidNode: function(n){
//			return this.getRelativeValidNode(n, "previous");
//		},
		handleModifier: function(data, active){
			var _modifiers = this._modifiers;
			if(active){
				_modifiers[_modifiers.length] = data;
			}else{
				for(var i = _modifiers.length; i--;){
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
		unwrap: function(node){
			for(var i = 0, l = node.childNodes.length; i < l; i++){
				node.parentNode.insertBefore(node.firstChild, node);
			}
			node.parentNode.removeChild(node);

		},
		removeEmptyNodesBottomUp: function(node){
			if(!node){
				return;
			}
			var pn, domNode = this.domNode;
			while(node && !node.childNodes.length && node != domNode){
				pn = node.parentNode;
				pn && pn.removeChild(node);
				node = pn;
			}

		},
		removeEmptyNodes: function(){
			var nodes, node, domNode = this.domNode, i, c = this.caret;
//			while((nodes = domNode.querySelectorAll("*:not(br):empty")).length > 1){
			while((nodes = domNode.querySelectorAll("*:empty")).length > 1){
				for(i = nodes.length; i--;){
					node = nodes[i];
					(node != c) && (node.parentNode.removeChild(node));
				}
			}
		},
		normalizeDocument: function(){
			this.removeEmptyNodes();
		},
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
		getContent: function(){
			return this.domNode.innerHTML;
		},
		blurAllInstances: function(){
			for(var i = instances.length; i--;){
				instances[i].blur();
			}
		},
		createEOL: function(){
			var EOL;
			(EOL = document.createElement("span")).appendChild(document.createTextNode("\n"));
			EOL.className = "EOL";
			return EOL;
		},
		isEOL: function(node){
			if(!node){
				return false;
			}
			var tagName, child;
			return !!((tagName = node.tagName) && tagName.toLowerCase() === "span" && (child = node.firstChild) &&
				child.nodeType === 3 && child.data.charCodeAt(0)  === 10);
		},
		isTextNode: function(node){
			if(!node){
				return false;
			}
			return node.nodeType === 3;
		},
		removeEmptyNodesFrom: function(n){
			if(!n){
				return;
			}
			var c = this.caret, len = n.childNodes.length, pn;
			while(n.nodeType != 3 && !len || len === 1 && n.firstChild === c && n !== this.domNode){
				pn = n.parentNode;
				n.firstChild && pn.insertBefore(n.firstChild, n);
				pn.removeChild(n);
				n = pn;
				len = n.childNodes.length;
			}

		},
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
		getModifiersFromCaret: function(){
			var domNode = this.domNode, node = this.getPreviousValidNode(this.caret).parentNode,
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
		notifyModifiers: function(){
			var plugins = this.plugins, i = plugins.length, h;
			while(i--){
				if(h = plugins[i].subscriptions.notifyModifiers){
					plugins[i][h].apply(plugins[i], arguments);
				}
			}
		},
		computeOffset: function(node, which){
			var ofs = 0, w = "offset" + which;
			do{
				ofs += node[w];
			}while(node = node.offsetParent); // thanks ppk!
			return ofs;
		},
		// refactor
		computeOffsetTop: function(node){
			return this.computeOffset(node, "Top");
		},
		computeOffsetLeft: function(node){
			return this.computeOffset(node, "Left");
		},
		/**
		 * moves the caret in the given direction
		 * @param {String} x
		 * @param {String} y
		 */
		moveCaret: function(x, y){
			// finger positioning: use splitText and elementFromPoint :)
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
		startViewportTimeout: function(evt){
			var self = this;
			this.viewportMoveInterval = setInterval(function(){ self.adjustViewport(evt) }, this.viewportMoveTime);
		},
		stopViewportTimeout: function(){
			this.autoscrollTimeout && clearTimeout(this.autoscrollTimeout);
			this.autoscrollTimeout = null;
			this.viewportMoveInterval && clearInterval(this.viewportMoveInterval);
			this.viewportMoveInterval = null;
		},
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
		getEOLs: function(){
			return this.domNode.querySelectorAll("span.EOL");
		},
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
		blinkCaret: function(){
			this.caret.style.display = this.caret.style.display === "inline" ? "none" : "inline";
		},
		showCaret: function(){
			var self = this;
			this._blink && clearInterval(this._blink);
			this._blink = setInterval(function(){ self.blinkCaret() }, this.blinkInterval);
		},
		hideCaret: function(){
			clearInterval(this._blink);
			this._blink = 0;
			this.caret.style.display = "none";
		},
		blur: function(){
			this.domNode.blur();
			this.onBlur();
		},
		onBlur: function(){
			var dn = this.domNode;
			this.focused = false;
			dn.className = dn.className.replace(" focused", "");
			this.hideKeyboard();
			this.hideCaret();
		},
		onFocus: function(){
			var dn = this.domNode;
			this.blurAllInstances();
			this.focused = true;
			this.showKeyboard();
			this.showCaret();
			dn.className = dn.className.replace(" focused", "") + " focused";
		},
		hideKeyboard: function(){
			LightEditor.Keyboard.hide();
		},
		showKeyboard: function(){
			LightEditor.Keyboard.show();
		}
	};
	LightEditor.plugins = {};
})();