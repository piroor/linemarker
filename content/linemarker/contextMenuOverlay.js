/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Line Marker.
 *
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2002-2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro.outsider.reflex@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


var LineMarkerService = {

IOService : Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),

XHTMLNS : 'http://www.w3.org/1999/xhtml',


get popupNode()
{
	var popup = document.getElementById('contentAreaContextMenu');
	return popup && popup.triggerNode || document.popupNode;
},

setMarker : function(aNode, aData, aDelay)
{
	var targetWindow = aData ? aData.window : document.commandDispatcher.focusedWindow ;
	if (!targetWindow || Components.lookupMethod(targetWindow, 'top').call(targetWindow) == window)
		targetWindow = gBrowser.contentWindow;

	var winWrapper = new XPCNativeWrapper(targetWindow,
			'top',
			'document',
			'location',
			'getSelection()',
			'setTimeout()'
		);

	if (aNode) {
		if (aNode.id == 'context-linemarker-clear') {
			var nodes = this.getAllMarkersInDocument(winWrapper.document);
			for (var i = nodes.snapshotLength-1; i > -1; i--)
			{
				this.mClearMarkerLine(nodes.snapshotItem(i));
			}
			this.save(winWrapper.location.href);
			return true;
		}
		else if (aNode.id == 'context-linemarker-clear-one') {
			var node = this.mFindMarker(this.popupNode);
			if (node) this.clearOneMarker(winWrapper.location.href, node);
			return true;
		}
	}

	var docWrapper = new XPCNativeWrapper(winWrapper.document,
			'getElementsByTagNameNS()',
			'createRange()',
			'createElementNS()'
		);
	var nodeWrapper;
	var style,
		color,
		bgcolor,
		lineId,
		range;

	if (!aData) {
		if (aNode) {
			style   = aNode.getAttribute('lm-style');
			color   = aNode.getAttribute('lm-color');
			bgcolor = aNode.getAttribute('lm-bgcolor');
			if (!style && !color && !bgcolor) return true;
		}
		else {
			return true;
		}

		var selection = winWrapper.getSelection();
		if (!selection) return true;

		range = selection.getRangeAt(0);
		selection.removeAllRanges();

		lineId = 'id-'+encodeURIComponent(winWrapper.location.href)+'-'+Math.floor(Math.random()*100000);

		this.save(winWrapper.location.href, lineId, range, color, bgcolor, style);
	}
	else {
		style   = aData.style;
		color   = aData.color;
		bgcolor = aData.bgcolor;
		lineId  = aData.id;

		var done = false;

		if (aData.range) {
			range = aData.range;
		}
		else {
			var startNode = this.evaluateXPath(aData.startPath).snapshotItem(0);
			var endNode   = this.evaluateXPath(aData.endPath).snapshotItem(0);
			if (startNode && endNode) {
				range = docWrapper.createRange();
				try {
					range.setStart(startNode, aData.startOffset);
					range.setEnd(endNode, aData.endOffset);
					if (range.toString() == aData.content) done = true;
				}
				catch(e) {
				}
			}
			if (!done) {
				if (!aDelay) aDelay = 100;
				if (aDelay < 5000) {
					// Retry for a while after the tab is loaded or selected.
					winWrapper.setTimeout(function() {
						LineMarkerService.setMarker(null, aData, aDelay * 2);
					}, aDelay);
					return true;
				}
				else {
					// Clear invalid data.
					this.save(aData.uri, aData.id);
					return false;
				}
			}
		}
	}


	var rule = '';
	if (color)
		rule += 'color:'+color+' !important;';
	if (bgcolor)
		rule += 'background:'+bgcolor+' !important;';
	if (style)
		rule += style+';';

	var line   = docWrapper.createElementNS(this.XHTMLNS, 'span');
	line.setAttribute('class', 'linemarker-marked-line '+lineId);
	line.setAttribute('marker-style', rule);
	line.setAttribute('style', rule);


	if (range.startContainer == range.endContainer) {
		range.surroundContents(line.cloneNode(true));
	}
	else {
		var tempRange = targetWindow.document.createRange();

		// 選択範囲の始点でノードを切り分ける
		tempRange.setStart(range.startContainer, range.startOffset);
		tempRange.setEndAfter(range.startContainer);
		tempRange.insertNode(tempRange.extractContents());

		// 選択範囲の終点でノードを切り分ける
		tempRange.setEnd(range.endContainer, range.endOffset);
		tempRange.setStartBefore(range.endContainer);
		tempRange.insertNode(tempRange.extractContents());

		tempRange.detach();

		this.mWrapUpTexts(range.startContainer, range.endContainer, line);
	}

	range.detach();

	return true;
},

clearOneMarker : function(aURI, aMarker)
{
	if (!aMarker) return;

	var markers;
	var markerIds = {};

	var className = aMarker.getAttribute('class');
	var nodes = this.evaluateXPath('//*[@class="'+className+'"]', aMarker.ownerDocument);
	for (var i = nodes.snapshotLength-1; i > -1; i--)
	{
		markers = this.evaluateXPath('descendant::*[starts-with(@class, "linemarker-marked-line ")]', nodes.snapshotItem(i));
		if (markers.snapshotLength) {
			for (var j = 0, max = markers.snapshotLength; j < max; j++)
				markerIds[markers.snapshotItem(j).getAttribute('class').split(' ')[1]] = markers.snapshotItem(j);
		}

		this.mClearMarkerLine(nodes.snapshotItem(i));
	}
	var id = className.split(' ')[1];
	this.save(aURI, id);

	for (var i in markerIds)
		if (i != id)
			this.clearOneMarker(aURI, markerIds[i]);
//			this.updateDataFor(aMarker.ownerDocument.defaultView, i);
},

mClearMarkerLine : function(aLine)
{
	if (!aLine) return;

	var container = aLine.parentNode;
	var range = aLine.ownerDocument.createRange();
	range.selectNodeContents(aLine);
	var containedText = range.extractContents();

	// joint splitted text nodes
	if (containedText.firstChild.nodeType == Node.TEXT_NODE &&
		aLine.previousSibling &&
		aLine.previousSibling.nodeType == Node.TEXT_NODE) {
		aLine.previousSibling.nodeValue = aLine.previousSibling.nodeValue + containedText.firstChild.nodeValue;
		containedText.removeChild(containedText.firstChild);
	}
	else if (containedText.lastChild.nodeType == Node.TEXT_NODE &&
		aLine.nextSibling &&
		aLine.nextSibling.nodeType == Node.TEXT_NODE) {
		aLine.nextSibling.nodeValue = containedText.lastChild.nodeValue + aLine.nextSibling.nodeValue;
		containedText.removeChild(containedText.lastChild);
	}

	container.insertBefore(containedText, aLine);
	container.removeChild(aLine);

	range.detach();
},

// Find text nodes from aStartNode to aEndNode, and wrap up them in elemen node (aParent).
mWrapUpTexts : function(aStartNode, aEndNode, aContainer)
{
try{
	var node = aStartNode,
		nodeWrapper,
		containerWrapper = new XPCNativeWrapper(aContainer, 'cloneNode()'),
		newNode;

	var startRule  = '; border-right: 0 none !important;';
	var endRule    = '; border-left: 0 none !important;';
	var middleRule = '; border-right: 0 none !important; border-left: 0 none !important;';

	var getNodeWrapper = function(aNode)
		{
			return new XPCNativeWrapper(aNode,
					'hasChildNodes()',
					'firstChild',
					'nextSibling',
					'parentNode',
					'nodeType',
					'nodeValue',
					'cloneNode()'
				);
		};

	var count = 0;
	traceTree:
	do
	{
		nodeWrapper = getNodeWrapper(node);
		if (node != newNode &&
			nodeWrapper.hasChildNodes()) {
			node = nodeWrapper.firstChild;
			nodeWrapper = getNodeWrapper(node);
		}
		else {
			while (!nodeWrapper.nextSibling)
			{
				node = nodeWrapper.parentNode;
				if (!node) break traceTree;
				nodeWrapper = getNodeWrapper(node);
			}
			node = nodeWrapper.nextSibling;
			nodeWrapper = getNodeWrapper(node);
		}
		if (node == aEndNode) break traceTree;

		if (nodeWrapper.nodeType == Node.TEXT_NODE &&
			nodeWrapper.nodeValue.replace(/\s+/g, '')) {
			newNode = containerWrapper.cloneNode(true);

			if (count == 0) {
				newNode.setAttribute('style', containerWrapper.getAttribute('marker-style')+startRule);
			}
			else {
				newNode.setAttribute('style', containerWrapper.getAttribute('marker-style')+middleRule);
			}

			var newWrapper = new XPCNativeWrapper(newNode,
					'appendChild()',
					'lastChild'
				);
			newWrapper.appendChild(nodeWrapper.cloneNode(true));
			nodeWrapper = new XPCNativeWrapper(nodeWrapper.parentNode,
					'replaceChild()'
				);
			nodeWrapper.replaceChild(newNode, node);
			node = newNode;

			count++;
		}
	}
	while (node != aEndNode);

	if (newNode) {
		newNode.setAttribute('style', containerWrapper.getAttribute('marker-style')+endRule);
	}
}
catch(e){alert(e);}
	return;
},

mFindMarker : function(aNode)
{
	if (aNode.nodeType != Node.ELEMENT_NODE)
		aNode = aNode.parentNode;

	do {
		if ((aNode.getAttribute('class') || '').indexOf('linemarker-marked-line ') == 0)
			return aNode;
		aNode = aNode.parentNode;
	} while (aNode.parentNode && aNode.parentNode.nodeType == Node.ELEMENT_NODE);

	return null;
},

getAllMarkersInDocument : function(aDocument)
{
	return this.evaluateXPath('//*[starts-with(@class, "linemarker-marked-line ")]', aDocument);
},



updateContextMenu : function()
{
	var gCM          = window.gContextMenu,
		menuItem     = document.getElementById('context-linemarker'),
		clearItem    = document.getElementById('context-linemarker-clear');
		clearOneItem = document.getElementById('context-linemarker-clear-one');
	if (gCM)
		menuItem.hidden = !gCM.isTextSelected;

	var nodes = LineMarkerService.getAllMarkersInDocument(this.popupNode.ownerDocument);
	clearItem.hidden = !nodes.snapshotLength;

	clearOneItem.hidden = !LineMarkerService.mFindMarker(this.popupNode);
},





getXPathForNode : function(aNode)
{
	var path = [];
	var node = aNode;
	var newTarget;
	var nodes;
	var part;
	var name;
	var id;
	var i, max;
	var prefix = '/';

	backTraceTree:
	do {
		if (node.id) {
			path.unshift(node.localName+'[@id="'+node.id+'"]');
			prefix = '//';
			break;
		}
		else {
			part      = node.nodeType == Node.ELEMENT_NODE ? node.localName : 'text()';
			newTarget = null;
			parts     = [];
			do {
				nodes     = this.evaluateXPath('preceding-sibling::*[@id or @name]', node);
				if (nodes.snapshotLength) {
					newTarget = nodes.snapshotItem(0);
					nodes = this.evaluateXPath('following-sibling::'+part, newTarget);
					for (i = 0; nodes.snapshotItem(i) != node; i++) {}
					part = part+'['+(i+1)+']';

					if (id = newTarget.getAttribute('id'))
						parts.unshift('[@id="'+id+'"]/following-sibling::'+part);
					else
						parts.unshift('[@name="'+newTarget.getAttribute('name')+'"]/following-sibling::'+part);

					node = newTarget;
				}
				else {
					if (parts.length) {
						parts.unshift(newTarget.localName);
						path.unshift(parts.join(''));
					}
					if (newTarget) {
						newTarget = null;
						prefix = '//';
						break backTraceTree;
					}

					nodes = this.evaluateXPath(part, node.parentNode);
					for (i = 0, max = nodes.snapshotLength; i < max && nodes.snapshotItem(i) != node; i++) {}
					if (nodes.snapshotItem(i) != node) { // fallback, for markers in another marker or other cases...
						part = '*';
						nodes = this.evaluateXPath(part, node.parentNode);
						for (i = 0, max = nodes.snapshotLength; i < max && nodes.snapshotItem(i) != node; i++) {}
					}

					path.unshift(part+'['+(i+1)+']');
					node = node.parentNode;

				}
			} while (newTarget);
		}
	}
	while (node.parentNode);

	return prefix+path.join('/');
},

evaluateXPath : function(aExpression, aContextNode, aType)
{
	var doc = aContextNode ? (aContextNode.ownerDocument ?
					aContextNode.ownerDocument :
					aContextNode.nodeType == Node.DOCUMENT_NODE ?
						aContextNode : null
				) : null ;
	if (!doc) {
		doc = document.commandDispatcher.focusedWindow;
		doc = (doc.top == window) ? _content.document : doc.document ;
	}

	aExpression  = aExpression || '';
	aContextNode = aContextNode || doc;

	const type       = aType || XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
	const resolver   = {
		lookupNamespaceURI : function(aPrefix)
		{
			return '';
		}
	};
	return doc.evaluate(aExpression, aContextNode, resolver, type, null);
},

save : function(aURI, aId, aRange, aColor, aBgcolor, aStyle)
{
	if (!aURI) return;

	var data = this.readData() || '' ;
	if (!aRange) {
		if (aId)
			data = data.replace(new RegExp('<[^>]+>([^>]*\n)*id: +'+aId+'([^>]*\n)*</[^>]+>\n', ''), '');
		else
			data = data.replace(new RegExp('<'+aURI+'>([^>]*\n)*</'+aURI+'>\n', 'g'), '');
	}
	else {
		data = data.replace(new RegExp('<[^>]+>([^>]*\n)*id: +'+aId+'([^>]*\n)*</[^>]+>\n', ''), '');

		var newData = '<'+aURI+'>\n'+
			'id: '+aId+'\n'+
			'start: '+this.getXPathForNode(aRange.startContainer)+' ('+aRange.startOffset+')\n'+
			'end: '+this.getXPathForNode(aRange.endContainer)+' ('+aRange.endOffset+')\n'+
			'style: '+encodeURIComponent(aStyle || '')+'\n'+
			'color: '+aColor+'\n'+
			'bgcolor: '+aBgcolor+'\n'+
			'content: '+encodeURIComponent(aRange.toString())+'\n'+
			'</'+aURI+'>\n';

		data += newData;
	}
	this.writeData(data);
},

/*
updateDataFor : function(aWindow, aId)
{
	var markers = this.evaluateXPath('//*[@class="linemarker-marked-line '+aId+'"]', aWindow.document.documentElement);
	if (!markers.snapshotLength) return;

	var range = aWindow.document.createRange();
	range.setStartBefore(markers.snapshotItem(0));
	range.setEndAfter(markers.snapshotItem(markers.snapshotLength-1));

	var startContainer = range.startContainer;
	var startOffset    = range.startOffset;
	var endContainer   = range.endContainer.nextSibling || range.endContainer.parentNode;
	var endOffset      = range.endOffset;

	this.clearOneMarker(aWindow.location.href, markers.snapshotItem(0));
try {

	range.setStart(startContainer, startOffset);
	range.setEnd(endContainer, endOffset);
	var data = {
			uri   : aWindow.location.href,
			id    : aId,
			style : markers.snapshotItem(0).getAttribute('marker-style'),
			range : range
		};

alert(range.toString());
}
catch(e){alert(e);}
	this.setMarker(null, data);

	range.detach();
},
*/


load : function(aWindow)
{
	if (
		!aWindow ||
		aWindow.document.documentElement.getAttribute('linemarker-restored') == 'true'
		)
		return;

	var uri  = aWindow.location.href;
	var data = this.readData();
	if (!data) return;

	data = data.match(new RegExp('<'+uri+'>([^>]*\n)*</'+uri+'>\n', 'g'));
	if (!data || !data.length) return;

	var startResult, endResult, markerData;
	for (var i = 0, max = data.length; i < max; i++)
	{
		markerData = { window : aWindow };
		/^start: *(.+) +\(([0-9]+)\)$/m.test(data[i]);
		markerData.startPath   = RegExp.$1;
		markerData.startOffset = RegExp.$2;
		/^end: *(.+) +\(([0-9]+)\)$/m.test(data[i]);
		markerData.endPath   = RegExp.$1;
		markerData.endOffset = RegExp.$2;
		/^style: *(.+)$/m.test(data[i]);
		markerData.style = decodeURIComponent(RegExp.$1);
		/^color: *(.+)$/m.test(data[i]);
		markerData.color = RegExp.$1;
		/^bgcolor: *(.+)$/m.test(data[i]);
		markerData.bgcolor = RegExp.$1;
		/^id: *(.+)$/m.test(data[i]);
		markerData.id = RegExp.$1;
		/^content: *(.+)$/m.test(data[i]);
		markerData.content = decodeURIComponent(RegExp.$1);
		markerData.uri = uri;

		this.setMarker(null, markerData);
	}

	aWindow.document.documentElement.setAttribute('linemarker-restored', 'true');

	if (aWindow.frames && aWindow.frames.length)
		for (i = 0, max = aWindow.frames.length; i < max; i++)
			arguments.callee(aWindow.frames[i]);
},

onLoad : function(aEvent)
{
	if (aEvent.originalTarget &&
		aEvent.originalTarget.defaultView &&
		aEvent.originalTarget.defaultView.top == _content)
		window.setTimeout('LineMarkerService.load(_content);', 0);
},

onSelect : function(aEvent)
{
	if (aEvent.originalTarget &&
		aEvent.originalTarget.localName == 'tabs' &&
		aEvent.originalTarget.ownerDocument == document)
		window.setTimeout('LineMarkerService.load(_content);', 0);
},

readData : function()
{
	var uri = this.makeURIFromSpec(this.dataFilePath);
	try {
		var channel = this.IOService.newChannelFromURI(uri);
		var stream  = channel.open();

		var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
		scriptableStream.init(stream);

		var fileContents = scriptableStream.read(scriptableStream.available());

		scriptableStream.close();
		stream.close();

		return fileContents;
	}
	catch(e) {
	}

	return null;
},

writeData : function(aContent)
{
	if (!this.dataFilePath) return;

	var file = this.getFileFromURL(this.dataFilePath);
	if (file.exists()) file.remove(true);

	file.create(file.NORMAL_FILE_TYPE, 0666);

	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(file, 2, 0x200, false); // open as "write only"

	stream.write(aContent, aContent.length);

	stream.close();
},

getFileFromURL : function(aURL) 
{
	var tempLocalFile;
	try {
		var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
		tempLocalFile = fileHandler.getFileFromURLSpec(aURL);
	}
	catch(e) { // [[interchangeability for Mozilla 1.1]]
		try {
			tempLocalFile = this.IOService.getFileFromURLSpec(aURL);
		}
		catch(ex) { // [[interchangeability for Mozilla 1.0.x]]
			tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
			this.IOService.initFileFromURLSpec(tempLocalFile, aURL);
		}
	}
	return tempLocalFile;
},

makeURIFromSpec : function(aURI)
{
	try {
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var tempLocalFile;
			try {
				var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			}
			catch(ex) { // [[interchangeability for Mozilla 1.1]]
				try {
					tempLocalFile = this.IOService.getFileFromURLSpec(aURI);
				}
				catch(ex) { // [[interchangeability for Mozilla 1.0.x]]
					tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
					this.IOService.initFileFromURLSpec(tempLocalFile, aURI);
				}
			}
			newURI = this.IOService.newFileURI(tempLocalFile); // we can use this instance with the nsIFileURL interface.
		}
		else {
			newURI = this.IOService.newURI(aURI, null, null);
		}

		return newURI;
	}
	catch(e){
	}
	return null;
},





dataFilePath : null,

initialized : false,

init : function(aPersist)
{
	if (this.initialized) return;
	this.initialized = true;

	if (!document.getElementById('contentAreaContextMenu')) return;

	if (aPersist && aPersist.currentState != aPersist.PERSIST_STATE_FINISHED) {
		window.setTimeout(function(aPersist) { LineMarkerService.init(aPersist); }, 0, aPersist);
		return;
	}


	// RDFデータソースの指定を初期化

	const DIR = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
	var dir = DIR.get('ProfD', Components.interfaces.nsILocalFile);

	var tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
	tempLocalFile.initWithPath(dir.path);

	var profileDir;
	try {
		profileDir = this.IOService.newFileURI(tempLocalFile).spec;
	}
	catch(e) { // [[interchangeability for Mozilla 1.1]]
		profileDir = this.IOService.getURLSpecFromFile(tempLocalFile);
	}
	if (!profileDir.match(/\/$/)) profileDir += '/';
	var uri = profileDir+'linemarker.rdf';

	// create data file
	tempLocalFile = this.getFileFromURL(uri);
	if (!tempLocalFile.exists()) {
		var newURI = this.IOService.newURI('chrome://linemarker/locale/linemarker.rdf', null, null);

		var PERSIST = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
		if (PERSIST.saveURI.length == 3) // old implementation
			PERSIST.saveURI(newURI, null, tempLocalFile);
		else
			PERSIST.saveURI(newURI, null, null, null, null, tempLocalFile);

//		window.setTimeout(LineMarkerInit, 0, PERSIST);
//		return;
		uri = 'chrome://linemarker/locale/linemarker.rdf';
	}


	const RDF = Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService);

	var nodes   = document.getElementsByAttribute('class', 'linemarker-popup'),
		dsource = RDF.GetDataSource(uri);
	for (var i = 0; i < nodes.length; i++)
	{
		nodes[i].database.AddDataSource(dsource);
		nodes[i].builder.rebuild();
	}


	this.dataFilePath = profileDir+'linemarker.txt';


	window.setTimeout('LineMarkerService.initWithDelay();', 1000);
},

initWithDelay : function()
{
	gBrowser.addEventListener('load',   this.onLoad, true);
	gBrowser.addEventListener('select', this.onSelect, true);
	document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this.updateContextMenu, true);

	// Initialize menu items
	var menu   = document.getElementById('context-linemarker');
	var items  = menu.firstChild.childNodes,
		loaded = {},
		rule;
	for (var i = items.length-1; i > -1; i--)
	{
		if (loaded[items[i].getAttribute('label')] == 'loaded') {
			menu.firstChild.removeChild(items[i]);
			continue;
		}

		rule = 'appearance: none !important;'+
				'-moz-appearance: none !important;';
		if (items[i].getAttribute('lm-style'))
			rule += items[i].getAttribute('lm-style')+';';
		if (items[i].getAttribute('lm-color'))
			rule += 'color: '+items[i].getAttribute('lm-color')+' !important;';
		if (items[i].getAttribute('lm-bgcolor'))
			rule += 'background-color: '+items[i].getAttribute('lm-bgcolor')+' !important;';

		if (rule)
			items[i].setAttribute('style', rule);

		loaded[items[i].getAttribute('label')] = 'loaded';
	}
},

destroy : function()
{
	gBrowser.removeEventListener('load', this.onLoad, true);
	document.getElementById('contentAreaContextMenu').removeEventListener('popupshowing', this.updateContextMenu, false);
	try {
		window.removeEventListener('load', LineMarkerInit, false);
		window.removeEventListener('unload', LineMarkerDestruct, false);
	}
	catch(e) {
	}
}

};


function LineMarkerInit()
{
	LineMarkerService.init();
}
function LineMarkerDestruct()
{
	LineMarkerService.destroy();
}

window.addEventListener('load', LineMarkerInit, false);
window.addEventListener('load', LineMarkerInit, false); // falsafe
window.addEventListener('unload', LineMarkerDestruct, false);
