/* global UndoStack */

let cme = chrome.management;
let getI18N = chrome.i18n.getMessage;
let myid = getI18N('@@extension_id');

// Handle undo/redo events
// let undoStack = new UndoStack(document.body);

let escapeCssId = id => id.replace(/[@.]/g, '\\$0');

/**
 * GENERATE PAGE
 */
let qs                   = (q, scp=document) => scp.querySelector(q); 
let qsa                  = (q, scp=document) => [...scp.querySelectorAll(q)]; 
let searchField          = `<input id="searchField" placeholder="Search Extensions..." />`;
let eul                  = '<ul id="extList"></ul>';

let optionsPanelMarkup   = `<div id="options" class="options">
                                <span id="bulkOptions" class="bulkButtons">
                                    <button id="enableAllButton">Enable All</button>
                                    <button id="disableAllButton">Disable All</button>
                                </span>
                                <a id="extensionPageButton" href="chrome://extensions">Get More Extensions</a>
                            </div>`;

window.document.body.insertAdjacentHTML('afterbegin', searchField + optionsPanelMarkup + eul);

let $searchField         = qs('#searchField');
let $extULNode           = qs('#extList');
let $options             = qs('#options');
let $disableAllButton    = qs('#disableAllButton');
let $enableAllButton     = qs('#enableAllButton');
let $extensionPageButton = qs('#extensionPageButton');
let extensionLinkObjects = null;


$searchField.focus();
window.scrollTo(0, 0); // Fix overscroll caused by autofocus

// Generate extension list
getExtensions(extensions => {
	let listHTML = extensions
	.sort((a, b) => {
		if (a.enabled === b.enabled) {
			return a.name.localeCompare(b.name); // Sort by name
		}
		return a.enabled < b.enabled ? 1 : -1; // Sort by state
	})
    .map(createList);
    $extULNode.insertAdjacentHTML('beforeEnd', listHTML.join(''));
    qsa('.ext',$extULNode).forEach(ext=>ext.addEventListener('click', toggleExt));
});

/**
 * EVENT LISTENERS
 */

// Toggle on click
extensionLinkObjects = qsa('.extName', $extULNode);
extensionLinkObjects.forEach(extBtn => {
    extBtn.addEventListener('click', (e, trg = e.target) => {
    let extRecord = trg.parentNode,
        extID     = extRecord.id,
        currState = extRecord.disabled,
        flipState = (isEnabled) => {
            cme.setEnabled(id, isEnabled, () =>{
                let newClassName = isEnabled ? 'enabled' : 'disabled';
                extRecord.className = extRecord.className.replace(/ ?(en|dis)abled/gi, '') + ' ' + newClassName;
                extBtn.title = 'Click to ' + newClassName.slice(0,-1) + ' this extension.';
            });
        }
    });
});

// // Show extra buttons on right click
// $extULNode.on('contextmenu', '.ext', () => {
// 	$('[hidden]').removeAttr('hidden');
// 	return false;
// });

// // Enable uninstall button
// $extULNode.on('click', '.extUninstall', e => {
// 	cme.uninstall(e.currentTarget.parentNode.id);
// });

// Enable filtering
$searchField.addEventListener('onKeyUp', () => {
    console.log('search key up')
	let extensions  = qsa('#extList li');
    let keywords = new RegExp('(?=.*' + this.value.replace(/ +/g, ')(?=.*') + ')', 'gi');
    extensions.forEach(el => el.className = el.classList.remove('hidden') + ((keywords.test(el)) ? '' : ' hidden'));
});

// Enable disable all button
$disableAllButton.addEventListener('click', () => {
	toggleAll(false);
});
$enableAllButton.addEventListener('click', () => {
	toggleAll(true);
});

// Enable chrome:// links
qsa('[href^="chrome"]').forEach(link=>
    link.addEventListener('click', (e, trg=e.target) => {
        // alert(trg.href);
        // window.open(trg.href)
        chrome.tabs.create({url: trg.href});
        return false;
    })
);

// Update list on uninstall
cme.onUninstalled.addListener(id => {
	qs('#' + escapeCssId(id)).remove();
});

/**
 * FUNCTIONS
 */
function getIcon(icons=[], size = 16) {
console.log('icons :', icons);
	let defaultIcon = 'icons/puzzle.svg';
 console.log('defaultIcon :', defaultIcon);
    size *= window.devicePixelRatio; // Get retina size if necessary
    console.log('size :', size);
	if (icons == null || icons.length === 0) return defaultIcon;
    let iconOP = icons.filter(icnObj=>icnObj.size<=size).slice(-1)[0]
    console.log('iconOP :', iconOP);
    return iconOP ? iconOP.url : defaultIcon;
    
}

function createList(e) {
    let url    = e.installType === 'normal' ? `https://chrome.google.com/webstore/detail/${e.id}` : e.homepageUrl,
          optURL = e.optionsUrl               ? `chrome://extensions/?options=${e.id}`              : '';
    if(!url) url = '';
	return `
                <li class='ext ${e.enabled ? '' : 'disabled'} type-${e.installType}' id='${e.id}' data-name="${e.name.toLowerCase()}">
                    <button class='extName' title='${e.enabled ? 'Disable ' + e.name.replace(/'/g, "\'") : 'Enable ' + e.name.replace(/'/g, "\'")}'>
                        <img class='extIcon' src='${getIcon(e.icons, 16)}'>
                        ${e.name}
                    </button>
                    <a class='extOptions' href='chrome://extensions/?options=${e.id}' title='Extention Options' target='_blank'></a>
                    <a class="extUrl" href='${url}' title='Website URL' target='_blank'></a>
                    <a class="extMore" href='chrome://extensions/?id=${e.id}' title='View in Chrome Web Store' target='_blank'></a>
                    <button hidden class="extUninstall" title='Uninstall this Extension' ></button>
                </li>
	`;
}

function getTogglerParentmostNode(node){
    console.log(node, node.tagName, !/ul|body|html/i.test(node.tagName))
    if(/ul|body|html/i.test(node.tagName)) return null;
    if(!/li class="ext.+?id=/i.test(node.outerHTML)) return getTogglerParentmostNode(node.parentNode);
    return node;
}

function getExtDataObj(extID) {
    return new Promise( (resolve, reject) => 
        cme.get(
            extID, 
            obj => { 
                resolve(Object.assign({}, obj)) 
            }
        )
    )
}

function toggleExt(e, trg=e.target, parent=getTogglerParentmostNode(trg)) {
    let disEn = [' disabled', ' enabled'];
    let extChromeID = parent.id;
    if(!extChromeID)  return false;
    getExtDataObj(extChromeID)
    .then(dataObj=>{
        let newEnabledState = !dataObj.enabled;
        cme.setEnabled(dataObj.id, newEnabledState);
        parent.className = parent.className.replace(/ (dis|en)abled/gi, '') + disEn[+newEnabledState];
    })
}
    // return 
    
    // if(extsDOMNode == null) return null;
    // let extChromeID = extDOMNode.id;



    //     extsEnabled = 
    // console.log('extID :', extID);

    // if(extID) cme.get(extID, extObj => {
        // console.log(extObj)
		// let wereEnabled   = extensions.filter(ext => enable ? !ext.enabled : ext.enabled);
		// let selector      = wereEnabled.map(ext => '#' + escapeCssId(ext.id)).join(',');
        // let $wereEnabled  = $(selector)

        // wereEnabled.forEach(extension => {
        //     cme.setEnabled(extension.id, enable);
        //     let extObj = qs('#' + extension.id);
        //     extObj.classList.remove('disabled')
        //     if(enable) extObj.classList.add('disabled')
        // });
	// });


function toggleAll(enable) {
	getExtensions(extensions => {
		let wereEnabled   = extensions.filter(ext => enable ? !ext.enabled : ext.enabled);
		let selector      = wereEnabled.map(ext => '#' + escapeCssId(ext.id)).join(',');
        let $wereEnabled  = $(selector)

        wereEnabled.forEach(extension => {
            cme.setEnabled(extension.id, enable);
            let extObj = qs('#' + extension.id);
            extObj.classList.remove('disabled')
            if(enable) extObj.classList.add('disabled')
        });
	});
}

function getExtensions(callback) {
	cme.getAll(exts => {
		callback(exts.filter(ext => ext.type === 'extension' && ext.id !== myid));
	});
}
