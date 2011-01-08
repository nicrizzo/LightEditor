(function(){
	LightEditor.plugins.Toolbar = function(args){
		var buttonsCfg = this.buttonsCfg, buttonCfg, btnNode, domButtons;
		this.editor = args.editor;
		var eNode = this.eNode = this.editor.getDomNode();
		(this.domNode = document.createElement("div")).className = "LightEditorToolbar";
		eNode.parentNode.insertBefore(this.domNode, eNode);
		domButtons = this.domButtons = {};
		for(var i = 0, l = buttonsCfg.length; i < l; i++){
			buttonCfg = buttonsCfg[i];
			(btnNode = document.createElement("div")).className = "button" + (buttonCfg.className ? " " + buttonCfg.className : "");
			btnNode.innerHTML = buttonCfg["name"];
			btnNode.setAttribute("data-value", buttonCfg["data"]);
			btnNode.setAttribute("data-type", buttonCfg["type"]);
			domButtons[buttonCfg.id] = this.domNode.appendChild(btnNode);
			switch(buttonCfg.type){
				case "toggle":
					domButtons[buttonCfg.id].active = false;
				break;
				default:
				break;
			}
		}
		this.setupButtons();
		this.connectEvents();
	};

	LightEditor.plugins.Toolbar.prototype = {
		subscriptions: {
			"notifyModifiers": "setKeyActive"
		},
		editor: null,
		domNode: null,
		eNode: null,
		domButtons: {},
		hasLayout: true,
		buttonsCfg: [
			{ name: "B", value: "", className: "boldBtn", data: "B", type: "toggle", id: "bold" },
			{ name: "I", value: "", className: "italicBtn", data: "I", type: "toggle", id: "italic" },
			{ name: "U", value: "", className: "underlineBtn", data: "U", type: "toggle", id: "underline" }
		],
		buttonsStatus: {},
		colors: [{ name: "black", value: "rgb(0,0,0)" }, { name: "red", value: "rgb(255,0,0)" }, { name: "blue", value: "rgb(0,0,255)" }, { name: "yellow", value: "rgb(255,255,0)" }, { name: "magenta", value: "rgb(255,0,255)" }, { name: "orange", value: "rgb(255,100,0)" }, { name: "grey", value: "rgb(100,100,100)" }, { name: "white", value: "rgb(255,255,255)" }],
		connectEvents: function(){
			var self = this;
			this.domNode.addEventListener("touchstart", function(evt){ self.keyPress(evt) }, false);
		},
		notify: function(topic, args){
			this.editor.notify(topic, args);
		},
		setupButtons: function(){
			for(var i = 0, buttonsStatus = this.buttonsStatus, buttonStatus, buttonsCfg = this.buttonsCfg, l = buttonsCfg.length; i < l; i++){
				buttonStatus = buttonsStatus[buttonsCfg[i].data] = {};
				buttonStatus.active = false;
			}
		},
		setKeyActive: function(name, a){
			var bc = this.buttonsCfg.filter(function(i){ if(i.name === name){ return i }})[0];
			if(!bc){
				return;
			}
			var key = this.domButtons[bc.id],
				buttonStatus = this.buttonsStatus[bc.data]
			;
			if(key){
				key.className = key.className.replace(" active", "") + (a ? " active" : "");
				buttonStatus.active = a;
			}
		},
		keyPress: function(evt){
			var trg = evt.target, domButtons = this.domButtons, domButton, active;
			trg = evt.target, trg = trg.nodeType !== Node.TEXT_NODE ? trg : trg.parentNode;
			var data = trg.getAttribute("data-value"), type = trg.getAttribute("data-type") || "", buttonStatus;
//			type = "modifier";
			if(!trg.getAttribute("data-value")){
				console.log("exit");
				return;
			}
			buttonStatus = this.buttonsStatus[trg.getAttribute("data-value")];
			domButton = domButtons[trg.getAttribute("data-value")];
			switch(type){
				case "toggle":
					console.log("toggle");
					trg.className = trg.className.replace(" active", "");
					if(!buttonStatus.active){
						trg.className += " active";
					}
					active = buttonStatus.active = !buttonStatus.active;
					console.log("active "+ active);
				break;
				default:
				break;
			}
//			trg.className = "";
//			this.notify("KeyPress", [data || "", type, active]);
			this.notify("KeyPress", [data || "", "modifier", active]);
			evt.stopPropagation();
		},
		getHeight: function(){
			var s = window.getComputedStyle(this.domNode, null);
			return parseInt(s.getPropertyValue("height")) + parseInt(s.getPropertyValue("border-bottom-width"));
		}
	}
})();