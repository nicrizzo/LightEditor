typeof LightEditor === "undefined" && (LightEditor = {});
(function(){
	var observers = []
	;
	LightEditor.Keyboard = {
		viewport: null,
		domNode: null,
		visible: false,
		currentPanel: 0,
		panels: [],
		keys: {},
		template:
				'<div class="LightEditorKeyboard">' +
				'<div data-name="alpha-panel" class="panel">' +
					'<div><div class="first" data-value="q">Q</div><div data-value="w">W</div><div data-value="e">E</div><div data-value="r">R</div><div data-value="t">T</div><div data-value="y">Y</div><div data-value="u">U</div><div data-value="i">I</div><div data-value="o">O</div><div data-value="p">P</div><div data-type="meta" data-value="backspace" class="last">&lt;</div></div>' +
					'<div><div class="first" data-value="a">A</div><div data-value="s">S</div><div data-value="d">D</div><div data-value="f">F</div><div data-value="g">G</div><div data-value="h">H</div><div data-value="j">J</div><div data-value="k">K</div><div data-value="l">L</div><div data-type="meta" data-value="enter" class="enter last">Enter</div></div>' +
					'<div><div data-type="modifier" data-value="left-shift" class="first">&#8657</div><div data-value="z">Z</div><div data-value="x">X</div><div data-value="c">C</div><div data-value="v">V</div><div data-value="b">B</div><div data-value="n">N</div><div data-value="m">M</div><div data-value=",">,</div><div data-value=".">.</div><div data-type="modifier" data-value="right-shift" class="last">&#8657</div></div>' +
					'<div><div class="first large" data-value="numbers-panel" data-type="meta">.?123</div><div data-value="&nbsp;" class="spacebar last">                                                                 </div><div class="large" data-value="numbers-panel" data-type="meta">.?123</div><div data-type="meta" data-value="hidekbd" class="last">[v]</div></div>' +
				'</div>' +
				'<div data-name="numbers-panel" class="panel">' +
					'<div><div class="first" data-value="1">1</div><div data-value="2">2</div><div data-value="3">3</div><div data-value="4">4</div><div data-value="5">5</div><div data-value="6">6</div><div data-value="7">7</div><div data-value="8">8</div><div data-value="9">9</div><div data-value="0">0</div><div data-type="meta" data-value="backspace" class="last">&lt;</div></div>' +
					'<div><div class="first" data-value="-">-</div><div data-value="/">/</div><div data-value=":">:</div><div data-value=";">;</div><div data-value="(">(</div><div data-value=")">)</div><div data-value="$">$</div><div data-value="&amp;">&amp;</div><div data-value="@">@</div><div data-type="meta" data-value="enter" class="enter last">Enter</div></div>' +
					'<div><div class="first" data-value=".">.</div><div data-value=",">,</div><div data-value="?">?</div><div data-value="!">!</div><div data-value="&apos;">&apos;</div><div data-value="&quot;">&quot;</div><div class="last" data-value=".">.</div></div>' +
						'<div><div class="first large" data-value="alpha-panel" data-type="meta">ABC</div><div data-value="&nbsp;" class="spacebar last">                                                                 </div><div class="large" data-value="alpha-panel" data-type="meta">ABC</div><div data-type="meta" data-value="hidekbd" class="last">[v]</div></div>' +
				'</div>' +
				'</div>',
		/**
		 *
		 * @param {Object} observer
		 */
		registerObserver: function(observer){
			observers.push(observer)
		},
		/**
		 *
		 * @param {Object} observer
		 */
		unregisterObserver: function(observer){
			observers.splice(observers.indexOf(observer), 1);
		},
		show: function(){
			this.visible = true;
			this.domNode.style.display = "block";
			this.place();
		},
		hide: function(){
			this.visible = false;
			this.domNode.style.display = "none";
		},
		onScroll: function(evt){
			this.place();
		},
		place: function(args){
			var s = this.domNode.style, cs = window.getComputedStyle(this.domNode, false),
					scale = window.innerWidth / parseInt(cs.getPropertyValue("width"));
			s.WebkitTransformOrigin = "0 0";
			s.WebkitTransform = "scale(" + scale + ")";
			// 370: use the computed value instead
			s.top = window.scrollY + window.innerHeight - 365*scale + "px";
			s.left = window.scrollX + "px";
		},
		connectEvents: function(){
			var self = this;
			this.domNode.addEventListener("touchstart", function(evt){ self.keyPress(evt) }, false);
			window.addEventListener("orientationchange", this.onOrientationChange, false);
			document.addEventListener("scroll", function(){ self.onScroll.apply(self, arguments) }, false);
		},
		onOrientationChange: function(){},
		notify: function(topic, args){
			for(var i = observers.length; i--;){
				observers[i].notify(topic, args);
			}
		},
		setKeyActive: function(name, a){
			var key = this.keys[name];
			if(key){
				key.domNode.className = key.domNode.className.replace(" active", "") + (a ? " active" : "");
				key.active = a;
			}
		},
		keyPress: function(evt){
			var trg, data, type, modifierKey, keys = this.keys, active;
			trg = evt.target, trg = trg.nodeType !== Node.TEXT_NODE ? trg : trg.parentNode,
				data = trg.getAttribute("data-value"), type = trg.getAttribute("data-type") || ""
			;
			switch(type){
				case "meta":
						if(data.match(/-panel$/)){
							this.selectPanel(data);
						}
				break;
				case "modifier":
//					this.notify("ModifierPressed", [data || "", type]);
					// TODO: less code
					modifierKey = keys[data];
					if(modifierKey.active){
						if(data === "left-shift" || data === "right-shift"){
							this.setKeyActive("left-shift", false);
							this.setKeyActive("right-shift", false);
						}else{
							trg.className = trg.className.replace(" active", "");
							active = modifierKey.active = !modifierKey.active;
						}
					}else{
						if(data === "left-shift" || data === "right-shift"){
							this.setKeyActive("left-shift", true);
							this.setKeyActive("right-shift", true);
						}else{
							trg.className += " active";
							active = modifierKey.active = !modifierKey.active;
						}
					}

				break;
				default:
				break;
			}
			if(trg.tagName.toLowerCase() != "select"){
				evt.preventDefault();
				this.notify("KeyPress", [data || "", type, active]);
			}
			evt.stopPropagation();
			return data || "";
		},
		/**
		 * Selects a keyboard panel by name
		 * @param {String} panelName
		 */
		// TODO: refactor the selectPanel methods
		selectPanel: function(panelName){
			var panels = this.panels, panel, nextPanel, i;
			for(i = panels.length; i--;){
				panel = panels[i];
				if(panel.getAttribute("data-name") === panelName){
					nextPanel = panel;
				}
				panel.className = panel.className.replace(" selected", "");
			}
			nextPanel.className += " selected";
		},
		setupKeys: function(){
			var domNode = this.domNode, mk = domNode.querySelectorAll("[data-type='modifier']"), currentKey,
				keys = this.keys, i
			;
			for(i = mk.length; i--;){
				keys[(currentKey = mk[i]).getAttribute("data-value")] = {
					domNode: currentKey,
					active: false
				};
			}
		},
		startup: function(){
			var n = document.createElement("div"), viewport = this.viewport = document.createElement("meta");
			n.innerHTML = this.template;
			document.body.appendChild(this.domNode = n.firstChild);
			this.setupKeys();
			this.connectEvents();
			viewport.name = viewport.id = "viewport";
			document.querySelector("head").appendChild(viewport);
			this.panels = this.domNode.querySelectorAll(".panel");
			this.panels[this.currentPanel].className += " selected";
//			viewport.setAttribute("content", "width = 2000");
//			window.alert(window.orientation + " " + viewport.getAttribute("scale"));
		}
	};
	LightEditor.Keyboard.startup();
})();
