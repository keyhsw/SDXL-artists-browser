//
//
//
//
// global variables
var timer;
var artTypes = ['🎨','🧑','🏞️'];
var imgTypeShown = 0;
var log = '';
var editMode = false;
var windowWidth = 0;

//
//
//
// functions
function startUp() {
	updateFooter();
	insertArtists();
	insertCheckboxesFromArtistsData();
	insertCheckboxesFromCategories();
	loadCheckboxesState();
	showHideCategories();
	loadOptionsState();
	loadFavoritesState();
	hideAllArtists();
	unhideBasedOnPermissiveSetting();
	updateArtistsCountPerTag('start');
	rotatePromptsImages();
	sortArtists();
	sortTags();
	loadMostUsedTags();
	updateArtistsCountPerCategory();
	showHideLowCountTags();
}

function updateFooter() {
	let proto = window.location.protocol;
	if (proto.startsWith('http')) {
		var footer = document.getElementsByTagName('footer')[0];
		footer.classList.add('special');
		var el1 = document.createElement('span');
		el1.textContent = '';
		// footer.querySelectorAll('div')[0].prepend(el1);
	}
}

function insertArtists() {
	// artistsData is defined in the artists_and_tags.js file
	let missingFiles = '';
	var container = document.getElementById('image-container');
	let imagePromises = artistsData.map((artist) => {
		var last = artist[0];
		var first = artist[1];
		var tags1 = artist[2].replaceAll('|', ' ').toLowerCase();
		// class names can't start with a number, but some tags do
		// in these cases prepending with 'qqqq-'
		tags1 = tags1.replace(/(^|\s)(\d)/g, '$1qqqq-$2');
		var tags2 = artist[2].replaceAll('|', ', ').toLowerCase();
		var itemDiv = document.createElement('div');
		itemDiv.className = 'image-item ' + tags1;
		var itemHeader = document.createElement('span');
		var h3 = document.createElement('h3');
		itemHeader.appendChild(h3);
		var firstN = document.createElement('span');
		var lastN = document.createElement('span');
		firstN.className = 'firstN';
		lastN.className = 'lastN';
		firstN.textContent = `${first}`;
		lastN.textContent = `${last}`;
		h3.appendChild(firstN);
		h3.appendChild(lastN);
		h3.title = 'copy to clipboard';
		var h4 = document.createElement('h4');
		h4.textContent = tags2;
		h4.title = 'check/uncheck these tags';
		itemHeader.appendChild(h4);
		itemDiv.appendChild(itemHeader);
		var box = document.createElement('div');
		var imgTools = document.createElement('div');
		imgTools.className = 'imgTools';
		var artPrev = document.createElement('div');
		artPrev.className = 'art_prev';
		var artPrevSpan = document.createElement('span');
		artPrevSpan.textContent = '🧑';
		artPrev.appendChild(artPrevSpan);
		imgTools.appendChild(artPrev);
		var artStar = document.createElement('div');
		artStar.className = 'art_star';
		var artStarSpan = document.createElement('span');
		artStarSpan.textContent = '⭐️';
		artStar.appendChild(artStarSpan);
		imgTools.appendChild(artStar);
		var artNext = document.createElement('div');
		artNext.className = 'art_next';
		var artNextSpan = document.createElement('span');
		artNextSpan.textContent = '🏞️';
		artNext.appendChild(artNextSpan);
		imgTools.appendChild(artNext);
		box.appendChild(imgTools);
		var imgBox = document.createElement('div');
		imgBox.className = 'imgBox';
		var imgArtwork = document.createElement('img');
		var imgPortrait = document.createElement('img');
		var imgLandscape = document.createElement('img');
		imgArtwork.alt = `${first} ${last}` + ' - artwork';
		imgPortrait.alt = `${first} ${last}` + ' - portrait';
		imgLandscape.alt = `${first} ${last}` + ' - landscape';
		imgArtwork.className = 'img_artwork';
		imgPortrait.className = 'img_portrait hidden';
		imgLandscape.className = 'img_landscape hidden';
		let src = 'images/SDXL_1_0_thumbs/';
		if(first == '') {
			src += last.replaceAll(' ', '_');
		} else {
			src += first.replaceAll(' ', '_') + '_' + last.replaceAll(' ', '_');
		}
		// files use accented characters and huggingface stores the files with this encoding
		src = encodeURI(src.normalize("NFD"));
		imgBox.appendChild(imgArtwork);
		imgBox.appendChild(imgPortrait);
		imgBox.appendChild(imgLandscape);
		box.appendChild(imgBox);
		itemDiv.appendChild(box);
		container.appendChild(itemDiv);
		return Promise.allSettled([
			new Promise((resolve, reject) => {
				imgArtwork.onload = resolve;
				imgArtwork.onerror = () => {
					missingFiles += '<li>' + first + '_' + last + '-artwork.webp</li>';
					reject();
				};
				imgArtwork.src = src + '-artwork.webp';
			}),
			new Promise((resolve, reject) => {
				imgPortrait.onload = resolve;
				imgPortrait.onerror = () => {
					missingFiles += '<li>' + first + '_' + last + '-portrait.webp</li>';
					reject();
				};
				imgPortrait.src = src + '-portrait.webp';
			}),
			new Promise((resolve, reject) => {
				imgLandscape.onload = resolve;
				imgLandscape.onerror = () => {
					missingFiles += '<li>' + first + '_' + last + '-landscape.webp</li>';
					reject();
				};
				imgLandscape.src = src + '-landscape.webp';
			})
		]);
	});
	let report = document.getElementById('missing_images_report');
	Promise.allSettled(imagePromises).then(() => {
		if(missingFiles.indexOf('webp')>0) {
			report.innerHTML = missingFiles;
		} else {
			report.innerHTML = '<li>No thumbnails files are missing!  Enlarged images are loaded on hover.  If any are missing, they\'ll be listed here at that time.</li>'
		}
	});
}

function insertCheckboxesFromArtistsData() {
	var uniqueTags = new Set();
	artistsData.forEach(function(artist) {
		var tags = artist[2].split('|');
		tags.forEach(function(tag) {
			uniqueTags.add(tag.toLowerCase());
		});
	});
	var uTags = Array.from(uniqueTags);
	var toggles = document.getElementById('toggles');
	for(i=0,il=uTags.length;i<il;i++) {
		if(uTags[i].length > 0) {
			// 👆 shouldn't need to sanitize database, but just in case
			var label = document.createElement('label');
			var el = document.createElement('i');
			el.className = 'most_used_indicator';
			el.textContent = '+';
			var input = document.createElement('input');
			input.type = 'checkbox';
			input.name = uTags[i];
			input.value = uTags[i];
			input.checked = true;
			var span1 = document.createElement('span');
			span1.textContent = uTags[i];
			var span2 = document.createElement('span');
			span2.className = 'count';
			label.appendChild(el);
			label.appendChild(input);
			label.appendChild(span1);
			label.appendChild(span2);
			toggles.appendChild(label);
		}
	}
	var checkAll = document.querySelector('input[name="check-all"]');
	var divs = document.querySelectorAll('.image-item');
	checkAll.parentNode.querySelector('.count').textContent = ' - ' + divs.length.toLocaleString();
}

function insertCheckboxesFromCategories() {
	var useCategories = document.querySelector('input[name="use_categories"]').checked;
	for(i=0,il=tagCategories.length;i<il;i++) {
		let name = tagCategories[i][0];
		var label = document.createElement('label');
		label.dataset.categoryName = name;
		label.className = 'category';
		var input = document.createElement('input');
		input.type = 'checkbox';
		input.name = name;
		input.value = name;
		input.checked = true;
		var span1 = document.createElement('span');
		span1.textContent = name;
		var span2 = document.createElement('span');
		span2.className = 'count';
		label.appendChild(input);
		label.appendChild(span1);
		label.appendChild(span2);
		toggles.appendChild(label);
	}
}

function loadCheckboxesState() {
	let state = JSON.parse(localStorage.getItem('tagsChecked')) || {};
	let allChecked = true;
	for (let name in state) {
		if (document.querySelector('input[name="'+name+'"]')) {
			document.querySelector('input[name="'+name+'"]').checked = state[name];
			if(name != 'mode' && name != 'use_categories') {
				if(!state[name]) {
					allChecked = false;
				}
			}
		}
	}
	if(!allChecked) {
		document.querySelector('input[name="check-all"]').checked = false;
	}
}

function storeCheckboxState(checkbox) {
	let state = JSON.parse(localStorage.getItem('tagsChecked')) || {};
	state[checkbox.name] = checkbox.checked;
	localStorage.setItem('tagsChecked', JSON.stringify(state));
}

function storeCheckboxStateAll(isChecked) {
	let state = {};
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach(function(checkbox) {
		let isTop = checkbox.parentNode.classList.contains('top_control');
		if(!isTop || checkbox.name == 'favorite') {
			// is a tag checkbox, not a setting
			if(isChecked) {
				state[checkbox.name] = true;
			} else {
				state[checkbox.name]  = false;
			}
		}
	});
	localStorage.setItem('tagsChecked', JSON.stringify(state));
}

function loadOptionsState() {
	let state = JSON.parse(localStorage.getItem('tagsChecked')) || {};
	if(state['prompt']) {
		document.getElementById('options_prompts').querySelectorAll('.selected')[0].classList.remove('selected');
		document.getElementById(state['prompt']).classList.add('selected');
		if(state['prompt'] == 'promptA') {
			imgTypeShown = 0;
		} else if(state['prompt'] == 'promptP') {
			imgTypeShown = 1;
		} else if(state['prompt'] == 'promptL') {
			imgTypeShown = 2;
		}
	} else {
		// promptA is already highlighted by HTML
		imgTypeShown = 0;
	}
	if(state['artistSort']) {
		document.getElementById('options_artist_sort').querySelectorAll('.selected')[0].classList.remove('selected');
		document.getElementById(state['artistSort']).classList.add('selected');
	} else {
		// sortAR is already highlighted by HTML
	}
	if(state['tagSort']) {
		document.getElementById('options_tag_sort').querySelectorAll('.selected')[0].classList.remove('selected');
		document.getElementById(state['tagSort']).classList.add('selected');
	} else {
		// sortTC is already highlighted by HTML
	}
}

function highlightSelectedOption(selected) {
	if(selected == 'prev' || selected == 'next') {
		if(selected == 'prev') {
			imgTypeShown--;
			if(imgTypeShown < 0) { imgTypeShown = 2; }
		} else if(selected == 'next') {
			imgTypeShown++;
			if(imgTypeShown > 2) { imgTypeShown = 0; }
		}
		var links = document.getElementById('options_prompts').querySelectorAll('.link');
		links.forEach(function(link) {
			link.classList.remove('selected');
		});
		if(imgTypeShown == 0) {
			document.getElementById('promptA').classList.add('selected');
			doAlert('Showing artwork');
		} else if(imgTypeShown == 1) {
			document.getElementById('promptP').classList.add('selected');
			doAlert('Showing portraits');
		} else if(imgTypeShown == 2) {
			document.getElementById('promptL').classList.add('selected');
			doAlert('Showing landscapes');
		}
	} else {
		if(selected == 'promptA') {
			imgTypeShown = 0;
			doAlert('Showing artwork');
		} else if(selected == 'promptP') {
			imgTypeShown = 1;
			doAlert('Showing portraits');
		} else if(selected == 'promptL') {
			imgTypeShown = 2;
			doAlert('Showing landscapes');
		}
		var links = document.getElementById(selected).parentNode.querySelectorAll('.link');
		links.forEach(function(link) {
			link.classList.remove('selected');
		});
		document.getElementById(selected).classList.add('selected');
	}
}

function storeOptionsState() {
	let state = JSON.parse(localStorage.getItem('tagsChecked')) || {};
	if(document.getElementById('promptA').classList.contains('selected')) {
		state['prompt'] = 'promptA';
	} else if(document.getElementById('promptP').classList.contains('selected')) {
		state['prompt'] = 'promptP';
	} else {
		state['prompt'] = 'promptL';
	}
	if(document.getElementById('sortAR').classList.contains('selected')) {
		state['artistSort'] = 'sortAR';
	} else {
		state['artistSort'] = 'sortAA';
	}
	if(document.getElementById('sortTC').classList.contains('selected')) {
		state['tagSort'] = 'sortTC';
	} else {
		state['tagSort'] = 'sortTA';
	}
	localStorage.setItem('tagsChecked', JSON.stringify(state));
}

function rotatePromptsImages() {
	// hide all images
	let images = document.querySelectorAll('.imgBox img');
	images.forEach(function(image) {
		image.classList.add('hidden');
	});
	// unhide images matching highlighted option (imgTypeShown)
	if(imgTypeShown == 0) {
		images = document.querySelectorAll('.img_artwork');
	} else if(imgTypeShown == 1) {
		images = document.querySelectorAll('.img_portrait');
	} else if(imgTypeShown == 2) {
		images = document.querySelectorAll('.img_landscape');
	}
	images.forEach(function(image) {
		image.classList.remove('hidden');
	});
	// switch prev and next button icons
	let artIndex = 0;
	artIndex = imgTypeShown-1;
	if(artIndex < 0) { artIndex = 2; }
	let prevButtons = document.querySelectorAll('.art_prev span');
	prevButtons.forEach(function(span) {
		span.textContent = artTypes[artIndex];
	});
	artIndex = imgTypeShown+1;
	if(artIndex > 2) { artIndex = 0; }
	let nextButtons = document.querySelectorAll('.art_next span');
	nextButtons.forEach(function(span) {
		span.textContent = artTypes[artIndex];
	});
}

function updateArtistsCountPerTag(whoCalled) {
	var permissiveCheckbox = document.querySelector('input[name="mode"]');
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	var divs = document.querySelectorAll('.image-item');
	var hiddenDivs = document.querySelectorAll('.image-item.hidden');
	if(permissiveCheckbox.checked || whoCalled == 'start') {
		// on page load, we need to add all the counts first
		checkboxes.forEach(function(checkbox) {
			let isTop = checkbox.parentNode.classList.contains('top_control');
			if(!isTop) {
				var theClass = checkbox.name.replace(/(^|\s)(\d)/g, '$1qqqq-$2');
				var matchingDivs = document.querySelectorAll('.image-item.' + theClass);
				var count = matchingDivs.length;
				checkbox.parentNode.classList.remove('no_matches');
				checkbox.parentNode.querySelector('input').disabled = false;
				checkbox.parentNode.querySelector('.count').textContent = ' - ' + count.toLocaleString();
			}
		});
		updateArtistsCountPerCategory();
	}
	if(!permissiveCheckbox.checked) {
		checkboxes.forEach(function(checkbox) {
			let isTop = checkbox.parentNode.classList.contains('top_control');
			if(!isTop) {
				var count = 0;
				// class names can't start with a number, but some tags do
				// in these cases prepending with 'qqqq-'
				var theClass = checkbox.name.replace(/(^|\s)(\d)/g, '$1qqqq-$2');
				if(!permissiveCheckbox.checked) {
					// for strict mode, for each checkbox, only count artists with a classes matching all checked checkboxes
					var matchingDivs = document.querySelectorAll('.image-item.' + theClass + ':not(.hidden)');
					count = matchingDivs.length;
					if(count == 0) {
						checkbox.parentNode.classList.add('no_matches');
						checkbox.parentNode.querySelector('input').disabled = true;
					} else {
						checkbox.parentNode.classList.remove('no_matches');
						checkbox.parentNode.querySelector('input').disabled = false;
					}
				}
				checkbox.parentNode.querySelector('.count').textContent = ' - ' + count.toLocaleString();
			}
		});
	}
	updateCountOfArtistsShown(divs, hiddenDivs);
}

function updateArtistsCountPerCategory() {
	var imageItems = document.querySelectorAll('.image-item');
	let counts = [];
	for(i=0,il=tagCategories.length; i<il; i++) {
		counts[i] = 0;
	}
	imageItems.forEach(function(imageItem) {
		var classes = Array.from(imageItem.classList).map(className => {
			// class names can't start with a number,
			// so some classes were prepending with 'qqqq-'
			// which must be ignored
			return className.replace(/^qqqq-/, '');
		});
		for(i=0,il=tagCategories.length; i<il; i++) {
			if(tagCategories[i].map(c => c.toLowerCase()).some(c => classes.includes(c))) {
				counts[i]++;
			}
		}
	});
	for(i=0,il=tagCategories.length; i<il; i++) {
		let label = document.querySelector('[data-category-name="' + tagCategories[i][0] + '"]');
		label.querySelector('.count').textContent = ' - ' + counts[i].toLocaleString();
	}
}

function updateCountOfArtistsShown(divs, hiddenDivs) {
	if(!divs) {
		// when this is called by change of a checkbox, divs is not passed
		var divs = document.querySelectorAll('.image-item');
		var hiddenDivs = document.querySelectorAll('.image-item.hidden');
	}
	var visible = divs.length - hiddenDivs.length;
	var percent = Math.round((visible / divs.length) * 100) + '%';
	if(percent == '0%') {
		percent = '<1%';
	}
	var el = document.getElementById('artistsShown').querySelector('.count');
	el.textContent = 'shown - ' + visible.toLocaleString() + ' / ' + percent;
}

function checkAllInCategory(theCheckbox) {
	let thisLabel = theCheckbox.parentNode;
	if (thisLabel.classList.contains('category')) {
		let container = document.getElementById('toggles');
		let labels = container.getElementsByTagName('label');
		let isChecking = false;
		for (let label of labels) {
			// If we reach 'thisLabel', start checking.
			if(label === thisLabel) {
				isChecking = true;
				continue; // Skip 'thisLabel' itself.
			}
			// If 'isChecking' is true and we found another 'category', stop checking.
			if(isChecking && label.classList.contains('category')) {
				break;
			}
			// If 'isChecking' is true, check or uncheck the checkbox inside the current label.
			if(isChecking) {
				if(!label.classList.contains('hidden')) {
					// hidden labels must remain unchecked
					let checkbox = label.querySelector('input[type="checkbox"]');
					if(checkbox) {
						checkbox.checked = theCheckbox.checked;
					}
				}
			}
		}
	}
}

function hideAllArtists() {
	var imageItems = document.querySelectorAll('.image-item');
	imageItems.forEach(function(imageItem) {
		imageItem.classList.add('hidden');
	});
}

function unhideBasedOnPermissiveSetting() {
	var permissiveCheckbox = document.querySelector('input[name="mode"]');
	if(permissiveCheckbox.checked) {
		permissiveCheckbox.parentNode.classList.remove('warning');
		unhideArtistsPermissive();
	} else {
		permissiveCheckbox.parentNode.classList.add('warning');
		unhideArtistsStrict();
	}
	var unHidden = document.querySelectorAll('.image-item').length - document.querySelectorAll('.image-item.hidden').length;
	if(unHidden == 0) {
		document.getElementById('filtersHidingAll').classList.add('shown');
	} else {
		document.getElementById('filtersHidingAll').classList.remove('shown');
	}
}

function unhideArtistsPermissive() {
	// permissive mode unhides images that match ANY checked tag
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) classes
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	imageItems.forEach(function(imageItem) {
		var classes = Array.from(imageItem.classList).map(className => {
			// class names can't start with a number,
			// so some classes were prepending with 'qqqq-'
			// which must be ignored
			return className.replace(/^qqqq-/, '');
		});
		if(checked.some(c => classes.includes(c))) {
			imageItem.classList.remove('hidden');
		}
	});
}

function unhideArtistsStrict() {
	// strict mode unhides images that match ALL checked tags
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) classes
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	if(checked.length > 0) {
		imageItems.forEach(function(imageItem, index) {
			var classes = Array.from(imageItem.classList).map(className => {
				// class names can't start with a number,
				// so some classes were prepending with 'qqqq-'
				// which must be ignored
				return className.replace(/^qqqq-/, '');
			});
			if(checked.every(c => classes.includes(c))) {
				imageItem.classList.remove('hidden');
			}
		});
	} else {
		// while not strictly logical, it's needed because
		// nothing would be checkable if strict is entered while everything is unchecked
		imageItems.forEach(function(imageItem) {
			imageItem.classList.remove('hidden');
		});
	}
}

function unhideAristsExact() {
	// exact mode isn't currently used because almost no two artists have the same set of tags
	// exact mode unhides images that match ALL checked tags and NO unchecked tags
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) classes
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	var unchecked = checkboxes.filter(cb => !cb.checked).map(cb => cb.name);
	if(checked.length > 0) {
		imageItems.forEach(function(imageItem, index) {
			var classes = Array.from(imageItem.classList);
			if(checked.every(c => classes.includes(c))) {
				if(unchecked.every(c => !classes.includes(c))) {
					imageItem.classList.remove('hidden');
				}
			}
		});
	}
}

function checkOrUncheckAll(isChecked) {
	var divs = document.querySelectorAll('.image-item');
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	if(isChecked) {
		checkboxes.forEach(function(checkbox) {
			let label = checkbox.parentNode;
			let isTop = label.classList.contains('top_control');
			let isHidden = label.classList.contains('hidden');
			if(!isTop || checkbox.name == 'favorite') {
				if(!isHidden) {
					// hidden label must not be checked
					checkbox.checked = true;
				}
			};
		});
	} else {
		checkboxes.forEach(function(checkbox) {
			let label = checkbox.parentNode;
			let isTop = label.classList.contains('top_control');
			if(!isTop || checkbox.name == 'favorite') {
				checkbox.checked = false;
			}
		});
	}
}

function showInstructions() {
	document.getElementById('instructions').classList.add('shown');
	hideToggles();
}

function showAbout() {
	document.getElementById('about').classList.add('shown');
	hideToggles();
}

function showExport() {
	document.getElementById('export').classList.add('shown');
	hideToggles();
	var textarea = document.getElementById('export').getElementsByTagName('textarea')[0];
	var favorites = localStorage.getItem('favoritedArtists');
	var value = '';
	if(favorites) {
		value += 'You have favorited these artists:\r\n';
		for (let key in JSON.parse(favorites)) {
			if (JSON.parse(favorites)[key] === true) {
				let names = key.split("|");
				if(!names[0]) { names[0] = '(no first name)'; }
				value += '•' + names[0] + ',' + names[1] + '\r\n';
			}
		}
		value += '\r\n\r\nTo import these favorites later, click "copy to clipboard" and save to any file.  Then paste the text from that file into this text box, and click "import". The imported text must contain the JSON string below (the curly brackets and what\'s between them).  It must not contain any other more than one set of curly brackets.\r\n\r\n' + favorites;
		textarea.value = value;
	} else {
		value += 'You haven\'t favorited any artists yet.\r\n\r\n';
		value += 'To import favorites that you exported earlier, paste the text into this text box, and click "import".';
	}
}

function copyExportToClipboard() {
	var favorites = document.getElementById('export').getElementsByTagName('textarea')[0].value;
	navigator.clipboard.writeText(favorites);
	doAlert('Favorites copied to clipboard!');
}

function importFavorites() {
	let el = document.getElementById('export').getElementsByTagName('textarea')[0];
	let favorites = el.value;
	let startCount = (favorites.match(/{/g) || []).length;
	let endCount = (favorites.match(/}/g) || []).length;
	if (startCount > 1 || endCount > 1) {
		el.value = 'That text can\'t be imported because it contains multiple curly brackets {}.'
		return null;
	}
	let start = favorites.indexOf('{');
	let end = favorites.lastIndexOf('}');
	if (start === -1 || end === -1) {
		el.value = 'That text can\'t be imported because it contains zero curly brackets {}.'
		return null;
	}
	let jsonString = favorites.substring(start, end + 1);
	try {
		let jsonObject = JSON.parse(jsonString);
	   // Check structure of each key-value pair in jsonObject
		for (let key in jsonObject) {
			let value = jsonObject[key];
			if (!key.includes('|') || typeof value !== 'boolean') {
				el.value = 'That text can\'t be imported because the JSON string it contains doesn\'t contain a valid list of artists.'
				return null;
			}
		}
		if(confirm('This will overwrite any saved favorites.  Are you sure?')) {
			localStorage.setItem('favoritedArtists', jsonString);
			alert('Favorites were imported!');
			loadFavoritesState();
		} else {
			alert('Okay, you have cancelled the import.');
			return null;
		}
	} catch(e) {
		el.value = 'That text can\'t be imported because it doesn\'t contain a valid JSON sting.'
		return null;
	}
}

function hideInformation() {
	var information = document.querySelectorAll('.information');
	information.forEach(function(element) {
		element.classList.remove('shown');
	});
	showToggles();
}

function sortTags() {
	if(document.getElementById('sortTC').classList.contains('selected')) {
		sortTagsByCount();
	} else {
		sortTagsByAlpha();
	}
}

function sortTagsByAlpha() {
	var useCategories = document.querySelector('input[name="use_categories"]').checked;
	let container = document.getElementById('toggles');
	let labels = Array.from(container.getElementsByTagName('label'));
	if (!useCategories) {
		// <labels> with class="category" are hidden, sort all other labels together by alpha
		labels.sort(function(a, b) {
			var aValue = a.querySelector('input[type="checkbox"]').name;
			var bValue = b.querySelector('input[type="checkbox"]').name;
			return aValue.localeCompare(bValue);
		});
		labels.forEach(function(label) {
			let isTop = label.classList.contains('top_control');
			if(!isTop) {
				// appendChild will move the element to the end of the container
				container.appendChild(label);
			}
		});
	} else {
		let labelMap = labels.reduce((acc, label) => {
			// map:  keys are checkbox names, values are corresponding parent label element
			let checkboxName = label.querySelector('input[type="checkbox"]').name;
			acc[checkboxName.toLowerCase()] = label;
			return acc;
		}, {});
		// sort tags that exist in tagCategories under that category
		tagCategories.forEach(arrayOfTags => {
			// first append the label that matches the category name
			let categoryName = arrayOfTags[0];
			let categoryLabel = labelMap[categoryName.toLowerCase()];
			if (categoryLabel) {
				container.appendChild(categoryLabel);
			}
			// the append the sorted labels that match the tag
			let arrayOfTagsLower = arrayOfTags.slice(1).map(tag => tag.toLowerCase());
			arrayOfTagsLower.sort();
			arrayOfTagsLower.forEach(tag => {
				let label = labelMap[tag];
				if (label) {
					let isTop = label.classList.contains('top_control');
					if(!isTop) {
						label.dataset.isInCategory = categoryLabel.dataset.categoryName;
						// appendChild will move the element to the end of the container
						container.appendChild(label);
					}
					// remove this label from the map
					delete labelMap[tag];
				}
			});
			if(categoryName == 'important') {
				container.appendChild(document.getElementById('edit_most_used'));
			}
		});
		// this leaves all the tags that didn't exist in tagCategories sorted at the top
		let leftoverLabelsKeys = Object.keys(labelMap);
		leftoverLabelsKeys.sort();
		leftoverLabelsKeys.forEach(key => {
			let label = labelMap[key];
			if (label && !label.classList.contains('top_control') && !label.classList.contains('category')) {
				label.dataset.isInCategory = 'other';
				container.appendChild(label);
			}
		});
	}
}

function sortTagsByCount() {
	var useCategories = document.querySelector('input[name="use_categories"]').checked;
	let container = document.getElementById('toggles');
	let labels = Array.from(container.getElementsByTagName('label'));
	if (!useCategories) {
		labels.sort(function(a, b) {
			var numA = parseInt(a.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
			var numB = parseInt(b.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
			return numB - numA;
		});
		labels.forEach(function(label) {
			let isTop = label.classList.contains('top_control');
			if(!isTop) {
				// appendChild will move the element to the end of the container
				container.appendChild(label);
			}
		});
	} else {
		let labelMap = labels.reduce((acc, label) => {
			// map: keys are checkbox names, values are corresponding parent label element
			let checkboxName = label.querySelector('input[type="checkbox"]').name;
			acc[checkboxName.toLowerCase()] = label;
			return acc;
		}, {});
		tagCategories.forEach(arrayOfTags => {
			let categoryName = arrayOfTags[0];
			let categoryLabel = labelMap[categoryName.toLowerCase()];
			if (categoryLabel) {
				container.appendChild(categoryLabel);
			}
			// get the list of tags from the category array
			let arrayOfTagsLower = arrayOfTags.slice(1).map(tag => tag.toLowerCase());
			// Sort by the number in each label
			arrayOfTagsLowerExisting = [];
			arrayOfTagsLower.forEach(function(tag) {
				if(labelMap[tag]) {
					arrayOfTagsLowerExisting.push(tag);
				}
			});
			arrayOfTagsLowerExisting.sort((a, b) => {
				let labelA = labelMap[a];
				let labelB = labelMap[b];
				if(labelA && labelB){
					let numA = parseInt(labelA.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2), 10);
					let numB = parseInt(labelB.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2), 10);
					return numB - numA;
				} else {
					return 0;
				}
			});
			arrayOfTagsLowerExisting.forEach(tag => {
				let label = labelMap[tag];
				if (label) {
					let isTop = label.classList.contains('top_control');
					if (!isTop) {
						// appendChild will move the element to the end of the container
						label.dataset.isInCategory = categoryLabel.dataset.categoryName;
						container.appendChild(label);
					}
					// remove this label from the map
					delete labelMap[tag];
				}
			});
			if(categoryName == 'important') {
				container.appendChild(document.getElementById('edit_most_used'));
			}
		});
		let leftoverLabelsKeys = Object.keys(labelMap);
		// Sort the leftover labels keys by the number in each label
		leftoverLabelsKeys.sort((a, b) => {
			let labelA = labelMap[a];
			let labelB = labelMap[b];
			if(labelA && labelB){
				let numA = parseInt(labelA.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2), 10);
				let numB = parseInt(labelB.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2), 10);
				return numB - numA;
			} else {
				return 0;
			}
		});
		leftoverLabelsKeys.forEach(key => {
			let label = labelMap[key];
			if (label && !label.classList.contains('top_control') && !label.classList.contains('category')) {
				label.dataset.isInCategory = 'other';
				container.appendChild(label);
			}
		});
	}
}

function loadMostUsedTags() {
	let state = JSON.parse(localStorage.getItem('mustUsedTags')) || {};
	let mostUsedCategory = document.querySelector('[data-category-name="important"]');
	for(let tag in state) {
		if (state[tag]) {
			let label = document.querySelector('input[name="'+ tag +'"]').parentNode;
			label.classList.add('is_most_used');
			label.querySelectorAll('.most_used_indicator')[0].textContent = '-';
			mostUsedCategory.after(label);
			updateTagArrayToMatchMostUsed(true,label,tag);
		}
	};
}

function updateTagArrayToMatchMostUsed(isAdding,label,tag) {
	// need to updated tagCategories because it's used to show sums of the categories
	// the first category in tagCategories stores the important tags unless the database is messed up
	if(isAdding) {
		tagCategories[0].push(tag);
		// remove tag from its original category
		for(i=0,il<tagCategories.length; i<il; i++) {
			if(tagCategories[i][0] == label.dataset.isInCategory) {
				tagCategories[i] = tagCategories[i].filter(function(ele){
					return ele != tag;
				});
				break;
			}
		}
	} else {
		tagCategories[0] = tagCategories[0].filter(function(ele){
			return ele != tag;
		});
		// add tag back to it's original category
		for(i=0,il<tagCategories.length; i<il; i++) {
			if(tagCategories[i][0] == label.dataset.isInCategory) {
				tagCategories[i].push(tag);
				break;
			}
		}
	}
}

function storeMostUsedState(label) {
	var name = label.querySelector('input').name;
	let state = JSON.parse(localStorage.getItem('mustUsedTags')) || {};
	state[name] = label.classList.contains('is_most_used');
	localStorage.setItem('mustUsedTags', JSON.stringify(state));
}

function enterExitEditMostUsedMode(doExit) {
	let inputs = Array.from(document.querySelectorAll('input'));
	if(editMode || doExit) {
		// exit edit mode
		editMode = false;
		document.getElementById('edit_most_used').textContent = 'edit';
		document.getElementById('layout').classList.remove('edit_mode');
		inputs.forEach(function(input) {
			input.disabled = false;
		});
		let labels = Array.from(document.querySelectorAll('.was_moved'));
		labels.forEach(function(label) {
			// clean up classes added to track moved tags during edit mode
			label.classList.remove('was_moved');
		})
		updateArtistsCountPerCategory();
	} else {
		// enter edit mode
		editMode = true;
		document.getElementById('edit_most_used').textContent = 'exit editing';
		document.getElementById('layout').classList.add('edit_mode');
		inputs.forEach(function(input) {
			input.disabled = true;
		});
	}
}

function addRemoveIsMostUsed(label) {
	let mostUsedCategory = document.querySelector('[data-category-name="important"]');
	if(label.classList.contains('is_most_used')) {
		// remove it
		label.classList.remove('is_most_used');
		label.querySelectorAll('.most_used_indicator')[0].textContent = '+';
		let originalCategory = document.querySelector('[data-category-name="' + label.dataset.isInCategory + '"]');
		originalCategory.after(label);
		updateTagArrayToMatchMostUsed(false,label,label.querySelector('input').name);
	} else {
		// add it
		label.classList.add('is_most_used');
		label.querySelectorAll('.most_used_indicator')[0].textContent = '-';
		mostUsedCategory.after(label);
		updateTagArrayToMatchMostUsed(true,label,label.querySelector('input').name);
	}
	label.classList.add('was_moved');
}

function sortArtists()  {
	if(document.getElementById('sortAR').classList.contains('selected')) {
		sortArtistsByRandom();
	} else {
		sortArtistsByAlpha();
	}
}

function sortArtistsByAlpha() {
	var imageItems = Array.from(document.querySelectorAll('.image-item'));
	imageItems.sort(function(a, b) {
		var aValue = a.querySelector('.lastN').textContent;
		var bValue = b.querySelector('.lastN').textContent;
		return aValue.localeCompare(bValue);
	});
	imageItems.forEach(function(item) {
		// appendChild will move the element to the end of the container
		document.getElementById('image-container').appendChild(item);
	});
}

function sortArtistsByRandom() {
	var imageItems = Array.from(document.querySelectorAll('.image-item'));
	imageItems.forEach(function(item) {
		item.dataset.randomRank = Math.random();
	});
	imageItems.sort(function(a, b) {
		var aValue = a.dataset.randomRank;
		var bValue = b.dataset.randomRank;
		return bValue - aValue;
	});
	imageItems.forEach(function(item) {
		// appendChild will move the element to the end of the container
		document.getElementById('image-container').appendChild(item);
	});
}

function hideToggles() {
	document.getElementById('toggles').classList.add('hide');
}

function showToggles() {
	document.getElementById('toggles').classList.remove('hide');
}

function addOrRemoveFavorite(artist) {
	if(artist.classList.contains('favorite')) {
		artist.classList.remove('favorite');
	} else {
		artist.classList.add('favorite');
	}
}

function loadFavoritesState() {
	let state = JSON.parse(localStorage.getItem('favoritedArtists')) || {};
	let artists = document.getElementsByClassName('image-item');
	for(let artist of artists) {
		let artistName = artist.getElementsByClassName('firstN')[0].textContent + '|' + artist.getElementsByClassName('lastN')[0].textContent;
		if(state[artistName]) {
			artist.classList.add('favorite');
		} else {
			artist.classList.remove('favorite');
		}
	}
	updateFavoritesCount();
}

function storeFavoriteState(artist) {
	var artistName = artist.getElementsByClassName('firstN')[0].textContent + '|' + artist.getElementsByClassName('lastN')[0].textContent;
	var isFavorited = artist.classList.contains('favorite');
	let state = JSON.parse(localStorage.getItem('favoritedArtists')) || {};
	state[artistName] = isFavorited;
	localStorage.setItem('favoritedArtists', JSON.stringify(state));
}

function updateFavoritesCount() {
	var favoritedArtists = document.getElementsByClassName('favorite');
	var favoriteCount = favoritedArtists.length;
	var favoriteCounter = document.querySelectorAll('input[name="favorite"]')[0].parentNode.querySelector('.count');
	favoriteCounter.textContent = ' - ' + favoriteCount;
}

function doAlert(str) {
	var alert = document.getElementById('alert');
	alert.textContent = str;
	alert.classList.remove('show');
	window.clearTimeout(timer);
	timer = setTimeout(showAlert, 100);
}

function showAlert() {
	var alert = document.getElementById('alert');
	alert.classList.add('show');
	timer = setTimeout(hideAlert, 2000);
}

function hideAlert() {
	var alert = document.getElementById('alert');
	alert.classList.remove('show');
}

function copyStuffToClipboard(item,stuff) {
	if(stuff == 'name') {
		var str = item.closest('.image-item').getElementsByClassName('firstN')[0].textContent +
		' ' + item.closest('.image-item').getElementsByClassName('lastN')[0].textContent;
		doAlert('Copied to name clipboard!');
	} else if(stuff == 'tags') {
		console.log(item);
		var str = item.textContent;
		doAlert('Copied to tags clipboard!');
	}
	navigator.clipboard.writeText(str);
}

function toggleThisArtistsTags(tagsStr) {
	let names = tagsStr.split(', ');
	let allChecked = true;
	for(i=0,il=names.length;i<il;i++) {
		if(!document.querySelector('input[name="'+names[i]+'"]').checked) {
			allChecked = false;
			break;
		}
	}
	for(i=0,il=names.length;i<il;i++) {
		var checkbox = document.querySelector('input[name="'+names[i]+'"]');
		if(allChecked) {
			checkbox.checked = false;
		} else {
			checkbox.checked = true;
		}
		storeCheckboxState(checkbox);
	}
}

function showHideCategories() {
	let useCategories = document.querySelectorAll('input[name="use_categories"]')[0].checked;
	let categories = document.getElementsByClassName('category');
	for(let category of categories) {
		if(useCategories) {
			category.classList.remove('hidden');
		} else {
			category.classList.add('hidden');
		}
	}
	let editLink = document.getElementById('edit_most_used');
	if(useCategories) {
			editLink.classList.remove('hidden');
	} else {
			editLink.classList.add('hidden');
	}
}

function showHideLowCountTags() {
	var hideLowCount = document.querySelector('input[name="low_count"]').checked;
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach(function(checkbox) {
		if(hideLowCount) {
			if(checkbox.parentNode.classList.contains('category') || checkbox.parentNode.classList.contains('no_matches')) {
				// skip hide
			} else {
				let count = parseInt(checkbox.parentNode.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
				if(count < 3) {
					checkbox.checked = false;
					checkbox.parentNode.classList.add('hidden');
				}
			}
		} else {
			checkbox.parentNode.classList.remove('hidden');
		}
		showHideCategories();
	});
}

function loadLargerImages(imageItem) {
	let images = imageItem.querySelectorAll('img');
	let missingFiles = '';
	let imagePromises = Array.from(images).map((img) => {
		if(img.src.indexOf('_thumbs') > -1 && img.dataset.thumbSrc == undefined) {
			// don't try to load if we tried before
			let first = img.closest('.image-item').querySelector('.firstN').textContent;
			let last = img.closest('.image-item').querySelector('.lastN').textContent;
			return new Promise((resolve, reject) => {
				img.onload = () => {
					resolve();
				}
				img.onerror = () => {
					if(img.dataset.missingFiles == undefined) {
						img.dataset.missingFiles = true;
						missingFiles += '<li>' + img.src + '</li>';
						img.src = img.dataset.thumbSrc;
					}
					reject();
				};
				img.dataset.thumbSrc = img.src;
				img.src = img.src.replace('_thumbs','');
			});
		}
	});
	let report = document.getElementById('missing_images_report');
	if(imagePromises.length > 0) {
		Promise.allSettled(imagePromises).then(() => {
			if(missingFiles.indexOf('webp')>0) {
				report.innerHTML += missingFiles;
			}
		});
	}
}

function hideLargerImageBackup(imageItem) {
	// very fast mouse movement from the thumbnail to the larger image can
	// cause the browser to fail to detect that CSS imageItem:hover is no longer true
	// therefore we need this backup, but we minimize mousemove listening
	windowWidth = window.innerWidth;
	let layout = document.getElementById('layout');
	// store a reference to the bound function, allowing it to be removed
	imageItem.boundMouseMoveFunc = mouseMoveFunc.bind(null, imageItem);
	layout.addEventListener('mousemove', imageItem.boundMouseMoveFunc);
	timer = setTimeout(function() {
		cleanupEventListener(imageItem);
	}, 200);
}

function mouseMoveFunc(imageItem, e) {
	if (e.clientX < (windowWidth * 0.4)) {
		imageItem.getElementsByClassName('imgBox')[0].style.position = 'relative';
	}
}

function cleanupEventListener(imageItem) {
	imageItem.getElementsByClassName('imgBox')[0].style.position = '';
	let layout = document.getElementById('layout');
	// remove the previously bound function
	layout.removeEventListener('mousemove', imageItem.boundMouseMoveFunc);
}

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
// content loaded function
document.addEventListener("DOMContentLoaded", function() {
	//
	//
	startUp();
	//
	//
	// add checkbox event listeners
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach(function(checkbox) {
		let isTop = checkbox.parentNode.classList.contains('top_control');
		if(!isTop || checkbox.name == 'favorite') {
			// normal checkboxes
			checkbox.addEventListener('change', function(e) {
				checkAllInCategory(e.target);
				hideAllArtists();
				unhideBasedOnPermissiveSetting();
				storeCheckboxState(e.target);
				updateArtistsCountPerTag('click');
			});
		} else {
			// top checkboxes
			if(checkbox.name == 'check-all') {
				checkbox.addEventListener('change', function(e) {
					checkOrUncheckAll(this.checked);
					storeCheckboxStateAll(this.checked);
					hideAllArtists();
					unhideBasedOnPermissiveSetting();
					updateArtistsCountPerTag('click');
				});
			} else if(checkbox.name == 'mode') {
				checkbox.addEventListener('change', function(e) {
					hideAllArtists();
					unhideBasedOnPermissiveSetting();
					updateArtistsCountPerTag('click');
					storeCheckboxState(e.target);
				});
			} else if(checkbox.name == 'use_categories') {
				checkbox.addEventListener('change', function(e) {
					showHideCategories();
					sortTags();
					storeCheckboxState(e.target);
				});
			} else if(checkbox.name == 'low_count') {
				checkbox.addEventListener('change', function(e) {
					showHideLowCountTags();
					storeCheckboxState(e.target);
				});
			}
		}
	});
	// add options event listeners
	var infoI = document.getElementById('infoI');
	infoI.addEventListener('click', function(e) {
		showInstructions();
	});
	var infoA = document.getElementById('infoA');
	infoA.addEventListener('click', function(e) {
		showAbout();
	});
	var infoE = document.getElementById('infoX');
	infoX.addEventListener('click', function(e) {
		showExport();
	});
	// prompt options
	var promptA = document.getElementById('promptA');
	promptA.addEventListener('click', function(e) {
		highlightSelectedOption('promptA');
		rotatePromptsImages();
		storeOptionsState();
	});
	var promptP = document.getElementById('promptP');
	promptP.addEventListener('click', function(e) {
		highlightSelectedOption('promptP');
		rotatePromptsImages();
		storeOptionsState();
	});
	var promptL = document.getElementById('promptL');
	promptL.addEventListener('click', function(e) {
		highlightSelectedOption('promptL');
		rotatePromptsImages();
		storeOptionsState();
	});
	// add information event listeners
	var export_to_clipboard = document.getElementById('export_to_clipboard');
	export_to_clipboard.addEventListener('click', function(e) {
		copyExportToClipboard();
	});
	var export_import = document.getElementById('export_import');
	export_import.addEventListener('click', function(e) {
		importFavorites();
	});
	var information = document.querySelectorAll('.information');
	information.forEach(function(element) {
		element.addEventListener('mouseleave', function(e) {
			if (!element.contains(e.relatedTarget)) {
				hideInformation();
			}
		});
	});
	// sort options
	var sortTA = document.getElementById('sortTA');
	sortTA.addEventListener('click', function(e) {
		sortTagsByAlpha();
		highlightSelectedOption('sortTA');
		storeOptionsState();
	});
	var sortTC = document.getElementById('sortTC');
	sortTC.addEventListener('click', function(e) {
		sortTagsByCount();
		highlightSelectedOption('sortTC');
		storeOptionsState();
	});
	var sortAA = document.getElementById('sortAA');
	sortAA.addEventListener('click', function(e) {
		sortArtistsByAlpha();
		highlightSelectedOption('sortAA');
		storeOptionsState();
	});
	var sortAR = document.getElementById('sortAR');
	sortAR.addEventListener('click', function(e) {
		sortArtistsByRandom();
		highlightSelectedOption('sortAR');
		storeOptionsState();
	});
	// must used mode
	var mostUsed = document.getElementById('edit_most_used');
	mostUsed.addEventListener('click', function(e) {
		enterExitEditMostUsedMode();
	});
	document.addEventListener('keydown', function(event) {
		if (event.key === 'Escape' || event.keyCode === 27) {
			// event.key for modern browsers, event.keyCode for older ones
			enterExitEditMostUsedMode('exit');
			hideInformation();
		}
	});
	var labels = document.querySelectorAll('label');
	Array.from(labels).forEach(function(label) {
		label.addEventListener('click', function(e) {
			if(editMode) {
				addRemoveIsMostUsed(this);
				storeMostUsedState(this);
			}
		});
	});
	// add artist event listeners
	var imageItems = document.getElementsByClassName('image-item');
	Array.from(imageItems).forEach(function(imageItem) {
		imageItem.addEventListener('mouseenter', function(e) {
			hideToggles();
			loadLargerImages(e.target);
			timer = setTimeout(hideLargerImageBackup.bind(this, this), 200);
		});
		imageItem.addEventListener('mouseleave', function(e) {
			showToggles();
		});
		imageItem.querySelector('.art_star').addEventListener('click', function(e) {
			addOrRemoveFavorite(this.closest('.image-item'));
			storeFavoriteState(this.closest('.image-item'));
			updateFavoritesCount();
		});
		imageItem.querySelector('.art_prev').addEventListener('click', function(e) {
			highlightSelectedOption('prev');
			rotatePromptsImages();
			storeOptionsState();
		});
		imageItem.querySelector('.art_next').addEventListener('click', function(e) {
			highlightSelectedOption('next');
			rotatePromptsImages();
			storeOptionsState();
		});
		imageItem.getElementsByTagName('h3')[0].addEventListener('click', function(e) {
			copyStuffToClipboard(this,'name');
		});
		imageItem.getElementsByTagName('h4')[0].addEventListener('click', function(e) {
			copyStuffToClipboard(this, 'tags')
			// toggleThisArtistsTags(this.textContent);
		});
	});
	// add footer event listeners
	var closeFooter = document.getElementById('close_footer');
	closeFooter.addEventListener('click', function(e) {
		document.getElementById('layout').classList.add('footerHidden');
	});
});
