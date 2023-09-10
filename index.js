//
//
//
//
// global variables
var timer;
var artTypes = ['🎨','🧑','🏞️'];
var imgTypeShown = 0;
var log = '';
var editMostUsedMode = false;
var informationMode = false;
var windowWidth = 0;
var gutterStartPosX, mouseStartPosX, gutterEndPercentX
var style, tempStyle, stylesheet, tempStylesheet, imgHoverRule, teaseRules;
var theTime = new Date;
var startUpTime;
var tagsConcatenated = new Set();
var editedArtists = new Set();
var storingAccessType = 'none';
var start = performance.now();
const lowCountThreshold = 3;
//
//
//
// wait for DOM
document.addEventListener("DOMContentLoaded", function() {
	checkStoringAccessType().then(state => {
		startUp();
	});
	startUpTime = theTime.getTime();
});

// functions
async function startUp() {
	updateTagsConcatenated();
	await loadEditedArtists();
	insertArtists();
	insertCheckboxesFromArtistsData();
	insertCheckboxesFromCategories();
	await loadCheckboxesState();
	showHideCategories();
	await loadOptionsState();
	await loadFavoritesState();
	hideAllArtists();
	unhideBasedOnPermissiveSetting();
	updateArtistsCountPerTag('start');
	rotatePromptsImages();
	sortArtists();
	sortTags();
	await loadMostUsedTags();
	updateArtistsCountPerCategory();
	showHideLowCountTags();
	makeStyleRuleForDrag();
	teasePartition();
	addAllListeners();
}

function checkStoringAccessType() {
	return new Promise((resolve, reject) => {
		try {
			localStorage.setItem('testKey', 'testValue');
			localStorage.removeItem('testKey');
			storingAccessType = 'localStorage';
			console.log('all settings saved using localStorage');
			resolve();
		} catch (error) {
			return caches.open('testCache')
				.then(cache => {
					const blob = new Blob([JSON.stringify('test')], { type: 'application/json' });
					const responseToCache = new Response(blob);
					cache.put('testCache', responseToCache).then(response => {
						storingAccessType = 'dataCache';
						console.log('all settings saved using dataCache');
						return;
					})
					.catch(error => {
						console.warn('no settings can be saved; we only have read access to cache: ' + error);
						resolve();
					});
				})
				.catch(error => {
					console.warn('no settings can be saved; no access to any storage method: ' + error);
					resolve();
				});
		}
	}).catch(error => {
		console.warn('had error writing to localStorage: ', error);
	});
}

function loadItemBasedOnAccessType(item) {
	if(storingAccessType == 'localStorage') {
		return new Promise((resolve, reject) => {
			try {
				const state = JSON.parse(localStorage.getItem(item));
				resolve(state || {});
			} catch (error) {
				reject(error);
			}
		}).catch(error => {
			console.warn(item + ' had error loading from localStorage: ', error);
			return {};
		});
	} else if(storingAccessType == 'dataCache') {
		return caches.open('dataCache')
			.then(cache => {
				return cache.match(item);
			})
			.then(response => {
				if(response) {
					return response.json();
				}
				return {};
			})
			.catch(error => {
				console.warn(item + ' had error loading from cache: ', error);
			});
	} else if(storingAccessType == 'none') {
		return Promise.resolve({});
	}
}

function storeItemBasedOnAccessType(item, stateArray, key, value) {
	if(storingAccessType == 'localStorage') {
		try {
			if(stateArray) {
				localStorage.setItem(item, JSON.stringify(stateArray));
			} else {
				let state = JSON.parse(localStorage.getItem(item)) || {};
				state[key] = value;
				localStorage.setItem(item, JSON.stringify(state));
			}
		} catch (error) {
			console.warn(item + ' had error saving localStorage: ', error);
		}
	} else if(storingAccessType = 'dataCache') {
		caches.open('dataCache').then(cache => {
			if(stateArray) {
				const blob = new Blob([JSON.stringify(stateArray)], { type: 'application/json' });
				const responseToCache = new Response(blob);
				return cache.put(item, responseToCache);
			} else {
				// try to get the item state from the cache
				cache.match(item).then(response => {
					let state = {};
					if(response) {
						return response.json().then(cachedData => {
							state = cachedData || {};
							return state;
						});
					} else {
						return state;
					}
				}).then(state => {
					state[key] = value;
					// store the updated state back to the cache
					const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
					const responseToCache = new Response(blob);
					return cache.put(item, responseToCache);
				});
			}
		}).catch(error => {
			console.warn(item + ' had error saving to cache: ', error);
		});
	} else if(storingAccessType == 'none') {
		alertNoStoringAccess(0);
	}
}

async function deleteItemBasedOnAccessType(item) {
	if(storingAccessType == 'localStorage') {
		localStorage.removeItem(item);
	} else if(storingAccessType = 'dataCache') {
		await caches.delete(item);
	} else if(storingAccessType == 'none') {
		// nothing to do
	}
}

function alertNoStoringAccess(wait) {
	window.setTimeout(function(){
		let msg = '';
		msg += 'My apologies, your browser settings block the ability to save settings and favorites.  Suggestions:\n';
		msg += '1.  Try Firefox, Safari, or Edge\n'
		msg += '2.  Download the app to use offline\n';
		msg += '3.  On Chrome, enable 3rd-party cookies (not recommended)\n\n';
		msg += 'This app doesn\'t use cookies, never sends data to any server, and saves all data locally.  But since this app is hosted on Hugging Face, Chrome treats it as a "3rd-party".  Other browsers give you more nuanced control of your privacy settings.';
		alert(msg);
	},wait);
}

function updateTagsConcatenated() {
	// this set is used for tag editing mode
	for (var i=0, il=tagCategories.length; i<il; i++) {
		for (var j=1, jl=tagCategories[i].length; j<jl; j++) {
			// j=1 because we don't want to include the category name
			// we also exclude tags that have the in the format of "added-YYYY-MM-DD"
			let tag = tagCategories[i][j].replace(/, added-(\d|-)*/g,'');
			tagsConcatenated.add(tag);
		}
	}
	let tagsConcatenatedArray = Array.from(tagsConcatenated).sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});
	tagsConcatenated = new Set(tagsConcatenatedArray);
}

async function loadEditedArtists() {
	await loadItemBasedOnAccessType('editedArtists').then(state => {
		editedArtists = new Set(Array.from(state));
		let proto = window.location.protocol;
		let anyChanges = false;
		for (let i=0, il=artistsData.length; i<il; i++) {
			// find match in artistsData if first and last names match
			let artist = artistsData[i];
			let artistFound = Array.from(editedArtists).find(editedA => editedA[0] === artist[0] && editedA[1] === artist[1]);
			if(artistFound) {
				// check if the edit now matches the original
				let match = true;
				for (let j=0, jl=artist.length; j<jl; j++) {
					if (artist[j] !== artistFound[j]) {
						match = false;
					}
				}
				if(match) {
					anyChanges = true;
					editedArtists.delete(artistFound);
				} else {
					if (!proto.startsWith('http')) {
						// if this is a local file, then update artistData with the saved edits
						artistsData[i] = artistFound;
					}
				}
			}
		}
		if(anyChanges) {
			storeItemBasedOnAccessType('editedArtists',editedArtists,false,false);
		}
	});
}

function insertArtists() {
	// artistsData is defined in the artists_and_tags.js file
	let missingFiles = '';
	var container = document.getElementById('image-container');
	let imagePromises = artistsData.map((artist) => {
		var last = artist[0];
		var first = artist[1];
		var tags2 = artist[2].replaceAll('|', ', '); // for display
		// artists can have a tag in the format of "added-YYYY-MM"
		// we want that to show up as a filter, but not on the artist card
		tags2 = tags2.replace(/, added-(\d|-)*/g,'');
		var itemDiv = document.createElement('div');
		itemDiv.className = 'image-item';
		itemDiv.dataset.tagList = artist[2].toLowerCase();
		if(artist[3]) {
			itemDiv.dataset.deprecated = true;
		}
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
		h4.title = 'copy to clipboard';
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
		var artEdit = document.createElement('div');
		artEdit.className = 'art_edit';
		var artEditSpan = document.createElement('span');
		artEditSpan.textContent = '✍️';
		artEdit.appendChild(artEditSpan);
		imgTools.appendChild(artEdit);
		var artSearch = document.createElement('a');
		artSearch.className = 'art_search';
		artSearch.href = 'https://www.bing.com/images/search?q=' + artist[1].replace(' ','+') + '+' + artist[0].replace(' ','+') + '+artist';
		artSearch.target = '_blank';
		var artSearchSpan = document.createElement('span');
		artSearchSpan.textContent = '🌐';
		artSearch.appendChild(artSearchSpan);
		imgTools.appendChild(artSearch);
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
		if(artist[3]) {
			var deprecatedSpan = document.createElement('span');
			deprecatedSpan.textContent = 'this artist is unknown to SDXL - more info in the help ⁉️'
			deprecatedSpan.className = 'deprecated';
			imgBox.appendChild(deprecatedSpan);
			return Promise.allSettled([
				new Promise((resolve, reject) => {
					imgArtwork.style.display = 'none';
					imgArtwork.src = 'images/SDXL_1_0_thumbs/1x1.webp';
				}),
				new Promise((resolve, reject) => {
					imgPortrait.style.display = 'none';
					imgPortrait.src = 'images/SDXL_1_0_thumbs/1x1.webp';
				}),
				new Promise((resolve, reject) => {
					imgLandscape.style.display = 'none';
					imgLandscape.src = 'images/SDXL_1_0_thumbs/1x1.webp';
				})
			]);
		} else {
			// if not flagged as deprecated
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
		}
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
}

function insertCheckboxesFromCategories() {
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

async function loadCheckboxesState() {
	await loadItemBasedOnAccessType('tagsChecked').then(state => {
		let allChecked = true;
		for (let name in state) {
			if (document.querySelector('input[name="'+name+'"]')) {
				document.querySelector('input[name="'+name+'"]').checked = state[name];
				styleLabelToCheckbox(document.querySelector('input[name="'+name+'"]'));
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
	});
}

function storeCheckboxState(checkbox) {
	if(checkbox.name != 'check-all') {
		storeItemBasedOnAccessType('tagsChecked',false,checkbox.name,checkbox.checked);
	}
}

function storeCheckboxStateAll(isChecked) {
	let checkboxes = document.querySelectorAll('input[type="checkbox"]');
	let state = {};
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
	storeItemBasedOnAccessType('tagsChecked',state,false,false);
}

async function loadOptionsState() {
	await loadItemBasedOnAccessType('optionsChecked').then(state => {
		if(state['prompt']) {
			let optionsPrompts = document.getElementById('options_prompts');
			optionsPrompts.querySelectorAll('.selected')[0].classList.remove('selected');
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
	});
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
		let optionsPrompts = document.getElementById('options_prompts');
		var links = optionsPrompts.querySelectorAll('.link');
		links.forEach(function(link) {
			link.classList.remove('selected');
		});
		if(imgTypeShown == 0) {
			document.getElementById('promptA').classList.add('selected');
			doAlert('Showing artwork',0);
		} else if(imgTypeShown == 1) {
			document.getElementById('promptP').classList.add('selected');
			doAlert('Showing portraits',0);
		} else if(imgTypeShown == 2) {
			document.getElementById('promptL').classList.add('selected');
			doAlert('Showing landscapes',0);
		}
	} else {
		if(selected == 'promptA') {
			imgTypeShown = 0;
			doAlert('Showing artwork',0);
		} else if(selected == 'promptP') {
			imgTypeShown = 1;
			doAlert('Showing portraits',0);
		} else if(selected == 'promptL') {
			imgTypeShown = 2;
			doAlert('Showing landscapes',0);
		}
		var links = document.getElementById(selected).parentNode.querySelectorAll('.link');
		links.forEach(function(link) {
			link.classList.remove('selected');
		});
		document.getElementById(selected).classList.add('selected');
	}
}

function storeOptionsState() {
	let state = {};
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
	storeItemBasedOnAccessType('optionsChecked',state,false,false);
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
	if(whoCalled == 'start') {
		// on page load, we need to add all the counts first
		updateArtistsCountPerTagSlow();
	}
	timer = setTimeout(function() {
		// for checkbox, we defer counts because it's slow
		// delay for 100 to allow CSS animation to complete
		updateArtistsCountPerTagSlow();
	},100);
}

function updateArtistsCountPerTagSlow() {
	let permissiveCheckbox = document.querySelector('input[name="mode"]');
	let isPermissive = permissiveCheckbox.checked;
	let deprecatedCheckbox = document.querySelector('input[name="deprecated"]');
	let checkboxes = document.querySelectorAll('input[type="checkbox"]');
	let divs = document.querySelectorAll('.image-item');
	let hiddenDivs = document.querySelectorAll('.image-item.hidden');
	let deprecatedDivs = document.querySelectorAll('.image-item[data-deprecated="true"]');
	let last = performance.now();
	checkboxes.forEach(function(checkbox) {
		let isTop = checkbox.parentNode.classList.contains('top_control');
		if(!isTop) {
			let matchingDivs;
			if(isPermissive) {
				matchingDivs = document.querySelectorAll('.image-item[data-tag-list*="' + checkbox.name + '"]');
			} else {
				// for strict mode, for each checkbox, only count artists with a tags matching all checked checkboxes
				matchingDivs = document.querySelectorAll('.image-item[data-tag-list*="' + checkbox.name + '"]:not(.hidden)');
			}
			let filteredDivs = Array.from(matchingDivs).filter(mat => {
				// only includes the artists known to SD
				return !Array.from(deprecatedDivs).some(dep => dep === mat);
			});
			let count = 0;
			if(deprecatedCheckbox.checked) {
				count = filteredDivs.length;
			} else {
				count = matchingDivs.length;
			}
			if(!count) { count = 0; }
			checkbox.parentNode.querySelector('.count').textContent = ' - ' + count.toLocaleString();
			checkbox.parentNode.classList.remove('no_matches');
			checkbox.parentNode.querySelector('input').disabled = false;
			if(!isPermissive) {
				if(count == 0) {
					checkbox.parentNode.classList.add('no_matches');
					checkbox.parentNode.querySelector('input').disabled = true;
				}
			}
		}
	});
	updateCountOfAllArtistsShown(divs, hiddenDivs);
	if(isPermissive) {
		updateArtistsCountPerCategory();
	}
}

function updateArtistsCountPerCategory() {
	let imageItems = document.querySelectorAll('.image-item');
	let notDeprecatedItems = document.querySelectorAll('.image-item:not([data-deprecated="true"])');
	let deprecatedCheckbox = document.querySelector('input[name="deprecated"]');
	let countItems = imageItems;
	if(deprecatedCheckbox.checked) {
		countItems = notDeprecatedItems;
	}
	let counts = [];
	for(i=0,il=tagCategories.length; i<il; i++) {
		counts[i] = 0;
	}
	countItems.forEach(function(imageItem) {
		let tagList = imageItem.dataset.tagList.split('|');
		for(i=0,il=tagCategories.length; i<il; i++) {
			if(tagCategories[i].map(tag => tag.toLowerCase()).some(tag => tagList.includes(tag))) {
				counts[i]++;
			}
		}
	});
	for(i=0,il=tagCategories.length; i<il; i++) {
		let label = document.querySelector('[data-category-name="' + tagCategories[i][0] + '"]');
		if(tagCategories[i][0] == 'other') {
			label.querySelector('.count').textContent = '';
		} else {
			label.querySelector('.count').textContent = ' - ' + counts[i].toLocaleString();
		}
	}
}

function updateCountOfAllArtistsShown(divs, hiddenDivs) {
	var checkAll = document.querySelector('input[name="check-all"]').parentNode.querySelector('.count');
	var shown = document.getElementById('artistsShown').querySelector('.count');
	var deprecatedItems = document.querySelectorAll('[data-deprecated="true"]');
	if(!divs) {
		// when this is called by change of a checkbox, divs is not passed
		var divs = document.querySelectorAll('.image-item');
		var hiddenDivs = document.querySelectorAll('.image-item.hidden');
	}
	var total = 0;
	var visible = 0;
	if(document.querySelector('input[name="deprecated"]').checked) {
		total = divs.length - deprecatedItems.length;
		visible = total - hiddenDivs.length + deprecatedItems.length;
	} else {
		total = divs.length;
		visible = total - hiddenDivs.length;
	}
	var percent = Math.round((visible / total) * 100) + '%';
	if(percent == '0%') {
		percent = '<1%';
	}
	checkAll.textContent = ' - ' + total.toLocaleString();
	shown.textContent = 'shown - ' + visible.toLocaleString() + ' / ' + percent;
}

function styleLabelToCheckbox(checkbox) {
	if(checkbox.checked) {
		checkbox.parentNode.classList.add('isChecked');
	} else {
		checkbox.parentNode.classList.remove('isChecked');
	}
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

function uncheckedAllStrictMode(isChecked) {
	if(!isChecked) {
		// for strict mode, only allow one checked tag, the first one found
		let labels = Array.from(document.querySelectorAll('label'))
			.filter(l => !l.classList.contains('top_control'))
			.filter(l => !l.classList.contains('category'))
			.filter(l => l.querySelector('input').checked == true);
		if(document.querySelector('input[name="favorite"]').checked) {
			labels.unshift(document.querySelector('input[name="favorite"]').parentNode);
		}
		if(labels.length > 0) {
			document.querySelector('input[name="check-all"]').checked = false;
			checkOrUncheckAll(false);
			let checkbox = labels[0].querySelector('input');
			checkbox.checked = true;
			doAlert(checkbox.name + ' is checked',0);
		}
	}
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
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) tagList dataSet
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	imageItems.forEach(function(imageItem) {
		let tagList = imageItem.dataset.tagList.split('|');
		if(imageItem.classList.contains('favorite')) {
			tagList.push('favorite');
		}
		if(checked.some(tag => tagList.includes(tag))) {
			imageItem.classList.remove('hidden');
		}
	});
	hideDeprecated();
}

function unhideArtistsStrict() {
	// strict mode unhides images that match ALL checked tags
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) tagList dataSet
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	if(checked.length > 0) {
		imageItems.forEach(function(imageItem, index) {
			let tagList = imageItem.dataset.tagList.split('|');
			if(imageItem.classList.contains('favorite')) {
				tagList.push('favorite');
			}
			if(checked.every(tag => tagList.includes(tag))) {
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
	hideDeprecated();
}

function unhideAristsExact() {
	// exact mode isn't currently used because almost no two artists have the same set of tags
	// exact mode unhides images that match ALL checked tags and NO unchecked tags
	// the set of checkboxes is derived from the unique tags within the imageItem (Artists) tagList dataSet
	var imageItems = document.querySelectorAll('.image-item');
	var checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
		.filter(cb => !cb.parentNode.classList.contains("top_control"));
	checkboxes.push(document.querySelector('input[name="favorite"]'));
	var checked = checkboxes.filter(cb => cb.checked).map(cb => cb.name);
	var unchecked = checkboxes.filter(cb => !cb.checked).map(cb => cb.name);
	if(checked.length > 0) {
		imageItems.forEach(function(imageItem, index) {
			let tagList = imageItem.dataset.tagList.split('|');
			if(imageItem.classList.contains('favorite')) {
				tagList.push('favorite');
			}
			if(checked.every(tag => tagList.includes(tag))) {
				if(unchecked.every(tag => !tagList.includes(tag))) {
					imageItem.classList.remove('hidden');
				}
			}
		});
	}
	hideDeprecated();
}

function hideDeprecated() {
	if(document.querySelector('input[name="deprecated"]').checked) {
		let deprecatedItems = document.querySelectorAll('[data-deprecated="true"]');
		deprecatedItems.forEach(function(item, index) {
			item.classList.add('hidden');
		});
	}
}

function checkOrUncheckAll(isChecked) {
	let divs = document.querySelectorAll('.image-item');
	let checkboxes = document.querySelectorAll('input[type="checkbox"]');
	let permissiveCheckbox = document.querySelector('input[name="mode"]');
	let isPermissive = permissiveCheckbox.checked;
	if(isChecked) {
		if(isPermissive) {
			checkboxes.forEach(function(checkbox) {
				let label = checkbox.parentNode;
				let isTop = label.classList.contains('top_control');
				let isHidden = label.classList.contains('hidden');
				if(!isTop || checkbox.name == 'favorite') {
					if(!isHidden) {
						// hidden/disabled label must not be checked
						checkbox.checked = true;
						styleLabelToCheckbox(checkbox);
					}
				};
			});
		} else {
			// can't allow check-all for strict mode
			// because the order of checking change the available checkmarks
			document.querySelector('input[name="check-all"]').checked = false;
			doAlert('Only works in permissive mode',0);
		}
	} else {
		checkboxes.forEach(function(checkbox) {
			let label = checkbox.parentNode;
			let isTop = label.classList.contains('top_control');
			if(!isTop || checkbox.name == 'favorite') {
				checkbox.checked = false;
				styleLabelToCheckbox(checkbox);
			}
		});
	}
}

function showInfo() {
	document.getElementById('information').classList.add('shown');
	informationMode = true;
}

function hideInfo() {
	document.getElementById('info_search_input').value = '';
	document.getElementById('information').classList.remove('shown');
	informationMode = false;
}

function showInformation(tab) {
	let info = document.querySelectorAll('#information .selected');
	info.forEach(function(element) {
		element.classList.remove('selected');
	});
	document.getElementById('info_' + tab).classList.add('selected');
	document.getElementById('information_' + tab).classList.add('selected');
	document.getElementById('information_' + tab).scrollTop = 0;
	if (tab == 'actions') {
		document.getElementById('info_search_input').focus();
	} else if(tab == 'export') {
		showExport();
	}
}

function searchForTagsInfo(event) {
	let input = document.getElementById('info_search_input');
	if(input.dataset.match != '') {
		event.preventDefault();
		if(event.key === 'Backspace' || event.keyCode === 8) {
			input.value = '';
			input.dataset.match = '';
		} else {
			input.value = input.dataset.match;
		}
		return;
	}
	let output = document.getElementById('info_search_output');
	output.innerHTML = '';
	let matches = 0;
	let match = '';
	let range = 'start'
	let tags = document.querySelectorAll('#toggles label:not(.top_control):not(.category):not([data-is-in-category="other"]');
	tags.forEach(function(tag) {
		let tagName = tag.querySelector('input').name;
		if(tagName.toLowerCase().indexOf(input.value.toLowerCase()) > -1) {
			range = 'continue';
			let label = tag.cloneNode(true);
			label.addEventListener('change', function(e) {
				toggleMatchingTag(this);
			});
			output.appendChild(label);
			match = tagName;
			matches++;
		} else {
			if(range != 'start') {
				range = 'stop';
			}
		}
		if(range == 'stop') {
			return;
		}
	});
	if(matches == 0) {
		let noneFound = document.createElement('label');
		noneFound.textContent = 'no matching tags';
		output.appendChild(noneFound);
	} else if(matches == 1) {
		input.value = match;
		event.preventDefault();
		input.dataset.match = match;
	} else {
		sortInfoSearchTags(output);
	}
}

function sortInfoSearchTags(output) {
	let labels = Array.from(output.querySelectorAll('label'));
	let sortByCount = document.getElementById('sortTC').classList.contains('selected');
	labels.sort(function(a, b) {
		if(sortByCount) {
			var numA = parseInt(a.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
			var numB = parseInt(b.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
			return numB - numA;
		} else {
			var aValue = a.querySelector('input[type="checkbox"]').name;
			var bValue = b.querySelector('input[type="checkbox"]').name;
			return aValue.localeCompare(bValue);
		}
	});
	labels.forEach(function(label) {
		output.appendChild(label);
	});
}

function toggleMatchingTag(searchLabel) {
	let toggleLabels = document.getElementById('toggles').querySelectorAll('label');
	let searchInput = searchLabel.querySelector('input');
	let toggleMatch;
	for(i=0,il=toggleLabels.length; i<il; i++) {
		let toggleInput = toggleLabels[i].querySelector('input');
		if(toggleInput.value == searchInput.value) {
			toggleMatch = toggleLabels[i];
			break;
		}
	}
	toggleMatch.querySelector('input').checked = searchInput.checked;
	toggleMatch.classList.remove('hidden');
	toggleMatch.querySelector('input').dispatchEvent(new Event('change'));
	let input = document.getElementById('info_search_input');
	input.focus();
}

function searchShowRandomTags() {
	document.querySelector('input[name="check-all"]').checked = false;
	checkOrUncheckAll(false);
	hideAllArtists();
	unhideBasedOnPermissiveSetting();
	let output = document.getElementById('info_search_output');
	output.innerHTML = '';
	let tags = Array.from(document.querySelectorAll('#toggles label:not(.top_control):not(.category):not([data-is-in-category="other"])'));
	tags.forEach(function(tag) {
		tag.dataset.randomRank = Math.random();
	});
	tags.sort(function(a, b) {
		var aValue = a.dataset.randomRank;
		var bValue = b.dataset.randomRank;
		return bValue - aValue;
	});
	let firstLabel;
	for(i=0,il=6; i<il; i++) {
		let label = tags[i].cloneNode(true);
		label.addEventListener('change', function(e) {
			toggleMatchingTag(this);
		});
		output.appendChild(label);
		if(i==0) {
			firstLabel = label;
		}
	}
	// check-mark and toggle on the first random label
	firstLabel.querySelector('input').checked = true;
	toggleMatchingTag(firstLabel);
	// cleanup
	tags.forEach(function(tag) {
		delete tag.dataset.randomRank;
	});
}

function showExport() {
	// favorites
	var textareaF = document.getElementById('export_favorites_list');
	var favoritedArtists = false;
	loadItemBasedOnAccessType('favoritedArtists').then(state => {
		var value = '';
		if(state) {
			value += 'To import these favorites later, click "copy to clipboard" and save to any file.  Then paste the text from that file into this text box, and click "import". The imported text must contain the JSON string below (the curly brackets and what\'s between them).\r\n\r\n' + JSON.stringify(state);
			textareaF.value = value;
		} else {
			value += 'You haven\'t favorited any artists yet.\r\n\r\n';
			value += 'To import favorites that you exported earlier, paste the text into this text box, and click "import".';
			textareaF.value = value;
		}
	});
	// edits
	var textareaE = document.getElementById('export_edits_list');
	let editedArtistsArr = Array.from(editedArtists);
	if(editedArtistsArr.length > 0) {
		value = 'Post a comment with these edits on Hugging Face:\r\n\r\n';
		for(i=0,il=editedArtistsArr.length;i<il;i++) {
			let edit = editedArtistsArr[i];
			value += '["'+edit[0]+'","'+edit[1]+'","'+edit[2]+'",'+edit[3]+'],\r\n';
		}
	} else {
		value = '';
	}
	textareaE.value = value;
	// db
	var textareaA = document.getElementById('export_artists_list');
	value = '';
	artistsData = artistsData.sort((a, b) => {
		// compare by known to SDXL boolean
		if (a[3] && !b[3]) return 1;
		if (!a[3] && b[3]) return -1;
		// compare by last name (ignoring case)
		const lastNameComparison = a[0].toLowerCase().localeCompare(b[0].toLowerCase());
		if (lastNameComparison !== 0) return lastNameComparison;
		// compare by first name (ignoring case)
		return a[1].toLowerCase().localeCompare(b[1].toLowerCase());
	});
	for(i=0,il=artistsData.length;i<il;i++) {
		// sort tags within artist by alpha
		let artist = artistsData[i];
		let tags = artist[2].split('|');
		tags = tags.sort(function(a, b) {
			var aValue = a.toLowerCase();
			var bValue = b.toLowerCase();
			return aValue.localeCompare(bValue);
		});
		let newTags = [];
		let added = '';
		// move the 'added' tag to the end
		for (let i=0, il=tags.length; i<il; i++) {
			if(tags[i].match(/added-(\d|-)*/)) {
				added = tags[i];
			} else {
				newTags.push(tags[i]);
			}
		}
		newTags.push(added);
		// output updated artist
		artist[2] = newTags.join('|');
		value += '["'+artist[0]+'","'+artist[1]+'","'+artist[2]+'",'+artist[3]+'],\r\n';
	}
	textareaA.value = value;
}

function exportTextarea(type) {
	let contents = '';
	if(type == 'favorites') {
		contents = document.getElementById('export_favorites_list').value;
	} else if(type == 'edits') {
		contents = document.getElementById('export_edits_list').value;
	} else if(type == 'artists') {
		contents = document.getElementById('export_artists_list').value;
	}
	navigator.clipboard.writeText(contents)
		.then(() => {
			doAlert(type + ' copied to clipboard!',1);
		})
		.catch(() => {
			doAlert('😭😭 Can\'t access clipboard',1);
		});
}

function importFavorites() {
	let el = document.getElementById('export_favorites_list');
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
		let favoritesObject = JSON.parse(jsonString);
		// check structure of each key-value pair in favoritesObject
		for (let key in favoritesObject) {
			let value = favoritesObject[key];
			if (!key.includes('|') || typeof value !== 'boolean') {
				el.value = 'That text can\'t be imported because the JSON string it contains doesn\'t contain a valid list of artists.'
				return null;
			}
		}
		if(confirm('This will overwrite any saved favorites.  Are you sure?')) {
			storeItemBasedOnAccessType('favoritedArtists',favoritesObject,false,false);
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

async function loadMostUsedTags() {
	await loadItemBasedOnAccessType('mustUsedTags').then(state => {
		let mostUsedCategory = document.querySelector('[data-category-name="important"]');
		for(let tag in state) {
			if (state[tag]) {
				let label = document.querySelector('input[name="'+ tag +'"]');
				if(label) {
					label = label.parentNode;
					label.classList.add('is_most_used');
					label.querySelectorAll('.most_used_indicator')[0].textContent = '-';
					mostUsedCategory.after(label);
					updateTagArrayToMatchMostUsed(true,label,tag);
				}
			}
		}
	});
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
	storeItemBasedOnAccessType('mustUsedTags',false,name,label.classList.contains('is_most_used'));
}

function enterExitEditMostUsedMode(doExit) {
	if(storingAccessType == 'none') {
		alertNoStoringAccess(0)
	} else {
		let inputs = Array.from(document.querySelectorAll('input'));
		if(editMostUsedMode || doExit) {
			// exit edit mode
			editMostUsedMode = false;
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
			document.getElementById('toggles').style.width = 'calc(' + gutterEndPercentX + '% - 20px)';
			document.getElementById('gutter').style.left =  gutterEndPercentX + '%';
			document.getElementById('image-container').style.marginLeft = 'calc(' + gutterEndPercentX + '% + 50px)';
			updateArtistsCountPerCategory();
		} else {
			// enter edit mode
			editMostUsedMode = true;
			document.getElementById('edit_most_used').textContent = 'exit editing';
			document.getElementById('layout').classList.add('edit_mode');
			inputs.forEach(function(input) {
				input.disabled = true;
			});
			document.getElementById('toggles').style.width = '';
			document.getElementById('gutter').style.left =  '';
			document.getElementById('image-container').style.marginLeft = '';
		}
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

async function loadFavoritesState() {
	await loadItemBasedOnAccessType('favoritedArtists').then(state => {
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
	});
}

function storeFavoriteState(artist) {
	if(storingAccessType == 'none') {
		alertNoStoringAccess(0)
	} else {
		var artistName = artist.getElementsByClassName('firstN')[0].textContent + '|' + artist.getElementsByClassName('lastN')[0].textContent;
		var isFavorited = artist.classList.contains('favorite');
		storeItemBasedOnAccessType('favoritedArtists',false,artistName,isFavorited);
	}
}

function updateFavoritesCount() {
	var favoritedArtists = document.getElementsByClassName('favorite');
	var favoriteCount = favoritedArtists.length;
	var favoriteCounter = document.querySelectorAll('input[name="favorite"]')[0].parentNode.querySelector('.count');
	favoriteCounter.textContent = ' - ' + favoriteCount;
}

function doAlert(str,location) {
	var alert = document.getElementById('alert');
	alert.textContent = str;
	// remove show and cleartimeout to redo anim if alert called multiple times
	alert.classList.remove('show');
	window.clearTimeout(timer);
	if(location == 0) {
		alert.classList.add('left');
	} else {
		alert.classList.remove('left');
		// CSS defaults to right
	}
	timer = setTimeout(showAlert, 100);
}

function showAlert() {
	var alert = document.getElementById('alert');
	alert.classList.add('show');
	if(alert.classList.contains('left')) {
		// shorter display time because it covers the enlarged image
		timer = setTimeout(hideAlert, 1000);
	} else {
		timer = setTimeout(hideAlert, 2500);
	}
}

function hideAlert() {
	var alert = document.getElementById('alert');
	alert.classList.remove('show');
}

function copyStuffToClipboard(item,stuff) {
	if(stuff == 'name') {
		var str = item.closest('.image-item').getElementsByClassName('firstN')[0].textContent +
		' ' + item.closest('.image-item').getElementsByClassName('lastN')[0].textContent;
		navigator.clipboard.writeText(str)
			.then(() => {
				doAlert('Copied to name clipboard!',1);
			})
			.catch(() => {
				doAlert('😭😭 Can\'t access clipboard',1);
			});
	} else if(stuff == 'tags') {
		var str = item.textContent;
		navigator.clipboard.writeText(str)
			.then(() => {
				doAlert('Copied to tags clipboard!',1);
			})
			.catch(() => {
				doAlert('😭😭 Can\'t access clipboard',1);
			});
	} else if(stuff == 'copyAllNames') {
		let str = '';
		let count = 0;
		let imageItems = document.querySelectorAll('.image-item:not(.hidden)');
		let imageItemsArr = Array.from(imageItems).sort(function (a, b) {
			return a.querySelectorAll('h3 span')[1].textContent.toLowerCase().localeCompare(
				b.querySelectorAll('h3 span')[1].textContent.toLowerCase());
		});
		for(i=0,il=imageItemsArr.length;i<il;i++) {
			let item = imageItemsArr[i];
			str += item.querySelectorAll('h3 span')[0].textContent + ' ';
			str += item.querySelectorAll('h3 span')[1].textContent + '\n';
			count++;
		}
		if(count > 0) {
			navigator.clipboard.writeText(str)
				.then(() => {
					doAlert('Copied ' + count.toLocaleString() + ' names to clipboard!',1);
				})
				.catch(() => {
					doAlert('😭😭 Can\'t access clipboard',1);
				});
		} else {
			doAlert('No artists are visible!',1);
		}
	}
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
			var classes = checkbox.parentNode.classList;
			if(!classes.contains('category')
				&& !classes.contains('no_matches')
				&& !classes.contains('top_control')) {
				let count = parseInt(checkbox.parentNode.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
				if(count <= lowCountThreshold) {
					if(checkbox.checked) {
						checkbox.parentNode.dataset.hideDeferred = true;
					} else {
						if(!checkbox.parentNode.classList.contains('is_most_used')) {
							checkbox.parentNode.classList.add('hidden');
						}
					}
				}
			}
		} else {
			checkbox.parentNode.classList.remove('hidden');
		}
	});
	showHideCategories();
}

function hideLowCountSingle(checkbox) {
	let hideLowCount = document.querySelector('input[name="low_count"]').checked;
	let hideDeferred = checkbox.parentNode.dataset.hideDeferred;
	if(hideLowCount && hideDeferred) {
		// only present if the tag is below the hide threshhold but not hidden because the checkbox was checked
		checkbox.parentNode.classList.add('hidden');
		checkbox.parentNode.dataset.hideDeferred = false;
		doAlert('low-use tag hidden',0);
	}
}

function loadLargerImages(imageItem) {
	let images = imageItem.querySelectorAll('img');
	let missingFiles = 'some image file(s) are missing!\n';
	let imagePromises = Array.from(images).map((img) => {
		if(img.src.indexOf('_thumbs') > -1 && img.dataset.thumbSrc == undefined) {
			// don't try to load if we tried before
			if(!img.dataset.deprecated) {
				let first = img.closest('.image-item').querySelector('.firstN').textContent;
				let last = img.closest('.image-item').querySelector('.lastN').textContent;
				return new Promise((resolve, reject) => {
					img.onload = () => {
						resolve();
					}
					img.onerror = () => {
						if(img.dataset.missingFiles == undefined) {
							img.dataset.missingFiles = true;
							missingFiles += img.src + '\n';
							img.src = img.dataset.thumbSrc;
						}
						reject();
					};
					img.dataset.thumbSrc = img.src;
					let src = 'images/SDXL_1_0/';
					if(first == '') {
						src += last.replaceAll(' ', '_');
					} else {
						src += first.replaceAll(' ', '_') + '_' + last.replaceAll(' ', '_');
					}
					if(img.classList.contains('img_artwork')) {
						img.src = src + '-artwork.webp';
					} else if(img.classList.contains('img_portrait')) {
						img.src = src + '-portrait.webp';
					} else if(img.classList.contains('img_landscape')) {
						img.src = src + '-landscape.webp';
					}
				});
			}
		}
	});
	if(imagePromises.length > 0) {
		Promise.allSettled(imagePromises).then(() => {
			if(missingFiles.indexOf('webp')>0) {
				console.warn(missingFiles);
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

function makeStyleRuleForDrag() {
	style = document.createElement('style');
	document.head.appendChild(style);
	stylesheet = style.sheet;
	let index = stylesheet.insertRule('.image-item:hover .imgBox { width: 40%; }', 0);
	imgHoverRule = stylesheet.cssRules[index];
}

function movePartition(e) {
	let newPos = gutterStartPosX + e.pageX - mouseStartPosX;
	if(newPos < 240) {
		newPos = 240;
	} else if(newPos > window.innerWidth - 350) {
		newPos = window.innerWidth - 350;
	}
	let gutterEndPercentX = (newPos / window.innerWidth) * 100;
	document.getElementById('toggles').style.width = 'calc(' + gutterEndPercentX + '% - 20px)';
	document.getElementById('gutter').style.left =  gutterEndPercentX + '%';
	document.getElementById('image-container').style.marginLeft = 'calc(' + gutterEndPercentX + '% + 50px)';
	imgHoverRule.style.width = gutterEndPercentX + '%';
	// prevent text from being selected during drag
	clearSelection();
}

function clearSelection() {
	if (window.getSelection) {
		if (window.getSelection().empty) {
			// Chrome
			window.getSelection().empty();
		} else if (window.getSelection().removeAllRanges) {
			// Firefox
			window.getSelection().removeAllRanges();
		}
	} else if (document.selection) {
		// IE?
		document.selection.empty();
	}
}

function teasePartition() {
	tempStyle = document.createElement('style');
	tempStyle.id = 'teaseDragStyle';
	document.head.appendChild(tempStyle);
	tempStylesheet = tempStyle.sheet;
	// apply temporary rules
	window.setTimeout(function() {
		tempStylesheet.insertRule('#gutter div { '
			+ 'animation-name: gutter_tease;'
			+ 'animation-duration: 800ms;'
			+ 'animation-timing-function: ease-out;'
			+ 'animation-iteration-count: 1;'
			+ 'animation-direction: forward;'
		+ '}', 0);
	},1000);
	window.setTimeout(function() {
		document.getElementById('teaseDragStyle').remove();
	},2000);
}

function editTagsClicked(clickedImageItem) {
	if(storingAccessType == 'none') {
		alertNoStoringAccess(0);
	} else {
		let indicatorEl = clickedImageItem.querySelector('.art_edit span');
		if(indicatorEl.textContent == '✍️') {
			let artistWasInEditMode = editTagsFindArtistInEditMode(clickedImageItem);
			if(!artistWasInEditMode) {
				doAlert('Read help ⁉️ first',1);
			}
			editTagsEnterEditMode(clickedImageItem);
		} else {
			editTagsFindArtistInEditMode();
		}
	}
}

function editTagsEnterEditMode(imageItem) {
	// enter edit mode for item
	let indicatorEl = imageItem.querySelector('.art_edit span');
	indicatorEl.textContent = '❌';
	let tagArea = imageItem.querySelector('h4');
	tagArea.title = '';
	tagArea.classList.add('edit_mode');
	imageItem.classList.add('edit_mode');
	let firstN = imageItem.querySelector('.firstN').textContent;
	let lastN = imageItem.querySelector('.lastN').textContent;
	let tagList = [];
	for (let i=0, il=artistsData.length; i<il; i++) {
		let artist = artistsData[i];
		if(artist[0] == lastN && artist[1] == firstN) {
			let tagListStr = artist[2].replace(/\|added-(\d|-)*/g,'');
			tagList = tagListStr.split('|');
			tagList.unshift(artist[3]);
			break;
		}
	}
	tagArea.textContent = '';
	for (var i=0, il=tagList.length; i<il; i++) {
		addTagToEditor(tagArea,tagList[i]);
	}
	var adder = document.createElement('input');
	adder.type = 'text';
	adder.name = 'new_tag';
	adder.placeholder = 'add another tag';
	adder.dataset.match = '';
	adder.style.marginTop = '10px';
	tagArea.appendChild(adder);
	// add event listeners
	adder.addEventListener('focus', function(e) {
		var helper = document.createElement('span');
		helper.id = 'edit_mode_helper';
		this.parentNode.appendChild(helper);
	});
	adder.addEventListener('keyup', function(e) {
		searchForTags(this,e,tagList);
	});
	adder.addEventListener('blur', function(e) {
		this.value = '';
		window.setTimeout(function() {
			// need delay to allow helper row to be clicked
			if(document.getElementById('edit_mode_helper')) {
				document.getElementById('edit_mode_helper').remove();
			}
		}, 100);
	});
}

function editTagsFindArtistInEditMode(clickedImageItem) {
	let imageItems = document.querySelectorAll('.image-item');
	imageItems.forEach(function(imageItem) {
		if(imageItem !== clickedImageItem) {
			// for any other other artist in editing mode, exit
			let indicatorEl = imageItem.querySelector('.art_edit span');
			if(indicatorEl.textContent == '❌') {
				editTagsExitEditMode(imageItem);
				// let caller know that an artistWasInEditMode
				return true;
			}
		}
	});
}

function editTagsExitEditMode(imageItem) {
	// exit item edit mode for item
	let indicatorEl = imageItem.querySelector('.art_edit span');
	indicatorEl.textContent = '✍️';
	let tagArea = imageItem.querySelector('h4');
	tagArea.title = 'copy to clipboard';
	tagArea.classList.remove('edit_mode');
	imageItem.classList.remove('edit_mode');
	let tagList = '';
	let tagLabels = tagArea.querySelectorAll('label');
	tagLabels.forEach(function(label) {
		let input = label.querySelector('input');
		if(input.checked && input.value != 'known' && input.value != 'unknown') {
			tagList += input.value + ', ';
			label.remove();
		}
	});
	tagArea.querySelector('input').remove();
	tagArea.textContent = tagList.substring(0,tagList.length-2);
}

function addTagToEditor(tagArea, tagName) {
	var label = document.createElement('label');
	var input = document.createElement('input');
	input.type = 'checkbox';
	if(tagName === true || tagName === false) {
		input.name = 'known'
		input.value = 'known';
		// in db, true = hide unknown, but here true = known
		if(tagName) {
			input.checked = false;
		} else {
			input.checked = true;
		}
		tagName = 'known to SDXL'
	} else {
		input.name = tagName
		input.value = tagName;
		input.checked = true;
	}
	var span = document.createElement('span');
	span.textContent = tagName;
	label.appendChild(input);
	label.appendChild(span);
	tagArea.appendChild(label);
	// event listener
	input.addEventListener('change', function(e) {
		saveTagsForArtist(tagArea);
	});
}

function searchForTags(input, event, tagList) {
	if(input.dataset.match != '') {
		event.preventDefault();
		if(event.key === 'Backspace' || event.keyCode === 8) {
			input.value = '';
			input.dataset.match = '';
		} else if (event.key === 'Return' || event.keyCode === 13) {
			input.value = '';
			input.dispatchEvent(new Event('blur'));
			insertTag(input,input.dataset.match);
			input.dataset.match = '';
		} else {
			input.value = input.dataset.match;
		}
		return;
	}
	let helper = document.getElementById('edit_mode_helper');
	helper.innerHTML = '';
	let matches = 0;
	let match = '';
	let range = 'start'
	let tagsConcatenatedArray = Array.from(tagsConcatenated);
	for(i=0,il=tagsConcatenatedArray.length; i<il; i++) {
		let tag = tagsConcatenatedArray[i];
		for (var j=0, jl=tagList.length; j<jl; j++) {
			if(typeof tagList[i] == 'string') {
				// first tagList item is boolean
				if(tag.toLowerCase() == tagList[i].toLowerCase()) {
					break;
				}
			}
		}
		if(tag.toLowerCase().indexOf(input.value.toLowerCase()) > -1) {
			range = 'continue';
			let matchSpan = document.createElement('span');
			matchSpan.textContent = tag;
			helper.appendChild(matchSpan);
			matchSpan.addEventListener('click', function(e) {
				insertTag(e.target,e.target.textContent);
			});
			match = tag;
			matches++;
		} else {
			if(range != 'start') {
				range = 'stop';
			}
		}
		if(range == 'stop') {
			break;
		}
	}
	if(matches == 1) {
		input.value = match;
		event.preventDefault();
		input.dataset.match = match;
	}
}

function insertTag(matchSpan,tag) {
	let tagArea = matchSpan.closest('h4');
	let input = tagArea.querySelector('input[type="text"]');
	addTagToEditor(tagArea,tag);
	tagArea.appendChild(input);
	document.getElementById('edit_mode_helper').remove();
	saveTagsForArtist(tagArea);
	timer = setTimeout(focusInput.bind(this, input), 100);
}

function focusInput(input) {
	input.focus();
}

function saveTagsForArtist(tagArea) {
	// get new tags
	let tagLabels = tagArea.querySelectorAll('label');
	let newTagsArr = [];
	let artistKnown = true;
	tagLabels.forEach(function(label) {
		let input = label.querySelector('input');
		if(input.value == 'known') {
			artistKnown = input.checked;
		} else {
			if(input.checked) {
				newTagsArr.push(input.value);
			}
		}
	});
	// find match in artistsData
	let firstN = tagArea.closest('.image-item').querySelector('.firstN').textContent;
	let lastN = tagArea.closest('.image-item').querySelector('.lastN').textContent;
	let edit = [];
	for (let i=0, il=artistsData.length; i<il; i++) {
		let artist = artistsData[i];
		if(artist[0] == lastN && artist[1] == firstN) {
			// artists can have a tag in the format of "added-YYYY-MM-DD"
			// this was stripped earlier, so we need to add it back in
			let oldTagsArr = artist[2].split('|');
			for (let j=oldTagsArr.length-1; j>=0; j--) {
				// loop backwards because it should be at the end
				if(oldTagsArr[j].match(/added-(\d|-)*/)) {
					newTagsArr.push(oldTagsArr[j]);
				}
			}
			let newTagsStr = newTagsArr.join('|');
			artist[2] = newTagsStr;
			// in db, true = hide unknown, but here true = known
			if(artistKnown) {
				artist[3] = false;
			} else {
				artist[3] = true;
			}
			edit = artist;
			break;
		}
	}
	// replace old edits with new edits
	for (let i=0, il=editedArtists.length; i<il; i++) {
		let oldEdit = editedArtists[i];
		if(edit[0] == oldEdit[0] && edit[1] == oldEdit[1]) {
			editedArtists.delete(oldEdit);
		}
	}
	editedArtists.add(edit)
	// save edited artists locally
	storeItemBasedOnAccessType('editedArtists',Array.from(editedArtists),false,false);
}

function deleteAllEdits() {
	if(storingAccessType != 'none') {
		if(confirm('This will delete all of your edits.  Are you sure?')) {
			deleteItemBasedOnAccessType('editedArtists');
			alert('official database restored!  this page will reload...');
			location.reload();
		} else {
			alert('restore was cancelled!');
		}
	}
}

function addAllListeners() {
	// global
	document.addEventListener('keydown', function(event) {
		if(event.key === 'Escape' || event.keyCode === 27) {
			// event.key for modern browsers, event.keyCode for older ones
			enterExitEditMostUsedMode('exit');
			editTagsFindArtistInEditMode();
			hideInfo();
		}
	});
	document.addEventListener('keyup', function(event) {
		if(event.key === '/') {
			showInfo();
			showInformation('actions');
		}
	});
	document.querySelector('#layout').addEventListener('click', function(e) {
		if(informationMode) {
			e.preventDefault();
			if(!e.target.closest('#information')) {
				hideInfo();
			}
		}
	});
	// checkboxes
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach(function(checkbox) {
		let isTop = checkbox.parentNode.classList.contains('top_control');
		if(!isTop || checkbox.name == 'favorite') {
			// normal checkboxes
			checkbox.addEventListener('change', function(e) {
				checkAllInCategory(e.target);
				hideAllArtists();
				unhideBasedOnPermissiveSetting();
				updateArtistsCountPerTag('click');
				hideLowCountSingle(e.target);
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
					uncheckedAllStrictMode(this.checked);
					hideAllArtists();
					unhideBasedOnPermissiveSetting();
					updateArtistsCountPerTag('click');
				});
			} else if(checkbox.name == 'use_categories') {
				checkbox.addEventListener('change', function(e) {
					showHideCategories();
					sortTags();
				});
			} else if(checkbox.name == 'low_count') {
				checkbox.addEventListener('change', function(e) {
					showHideLowCountTags();
				});
			} else if(checkbox.name == 'deprecated') {
				checkbox.addEventListener('change', function(e) {
					hideAllArtists();
					unhideBasedOnPermissiveSetting();
					updateArtistsCountPerTag('click');
				});
			}
		}
		// all checkboxes
		checkbox.addEventListener('change', function(e) {
			styleLabelToCheckbox(this);
			clearSelection();
			storeCheckboxState(e.target);
		});
	});
	// information
	var options_info = document.getElementById('options_info');
	options_info.addEventListener('click', function(e) {
		showInfo();
		showInformation('actions');
		e.stopPropagation();
	});
	var info_actions = document.getElementById('info_actions');
	info_actions.addEventListener('click', function(e) {
		showInformation('actions');
	});
	var info_help = document.getElementById('info_help');
	info_help.addEventListener('click', function(e) {
		showInformation('help');
	});
	var info_tips = document.getElementById('info_tips');
	info_tips.addEventListener('click', function(e) {
		showInformation('tips');
	});
	var info_about = document.getElementById('info_about');
	info_about.addEventListener('click', function(e) {
		showInformation('about');
	});
	var info_export = document.getElementById('info_export');
	info_export.addEventListener('click', function(e) {
		showInformation('export');
	});
	var info_closer = document.getElementById('info_closer');
	info_closer.addEventListener('click', function(e) {
		hideInfo();
	});
	var info_search = document.getElementById('info_search_input')
	info_search.addEventListener('keyup', function(e) {
		searchForTagsInfo(e);
	});
	var infoToggleAll = document.getElementById('info-toggle-all');
	infoToggleAll.addEventListener('click', function(e) {
		let checkAll = document.querySelector('input[name="check-all"]');
		if(checkAll.checked) {
			checkAll.checked = false;
		} else {
			checkAll.checked = true;
		}
		checkAll.dispatchEvent(new Event('change'));
	});
	var copyAllNames = document.getElementById('copy-all-names');
	copyAllNames.addEventListener('click', function(e) {
		copyStuffToClipboard(this, 'copyAllNames')
	});
	var randomTags = document.getElementById('random-tags');
	randomTags.addEventListener('click', function(e) {
		searchShowRandomTags();
	});
	var export_favorites = document.getElementById('export_favorites_button');
	export_favorites.addEventListener('click', function(e) {
		exportTextarea('favorites');
	});
	var import_favorites = document.getElementById('import_favorites_button');
	import_favorites.addEventListener('click', function(e) {
		importFavorites();
	});
	var export_edits = document.getElementById('export_edits_button');
	export_edits.addEventListener('click', function(e) {
		exportTextarea('edits');
	});
	var delete_edits = document.getElementById('delete_edits_button');
	delete_edits.addEventListener('click', function(e) {
		deleteAllEdits();
	});
	var export_artists = document.getElementById('export_artists_button');
	export_artists.addEventListener('click', function(e) {
		exportTextarea('artists');
	});
	// prompts
	/*
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
	*/
	// sorting
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
	// most used mode
	var mostUsed = document.getElementById('edit_most_used');
	mostUsed.addEventListener('click', function(e) {
		enterExitEditMostUsedMode();
	});
	var labels = document.querySelectorAll('label');
	Array.from(labels).forEach(function(label) {
		label.addEventListener('click', function(e) {
			if(editMostUsedMode) {
				addRemoveIsMostUsed(this);
				storeMostUsedState(this);
			}
		});
	});
	// artists
	var imageItems = document.getElementsByClassName('image-item');
	Array.from(imageItems).forEach(function(imageItem) {
		imageItem.addEventListener('mouseenter', function(e) {
			let imgTime = new Date;
			let imgHoverTime = imgTime.getTime();
			if(imgHoverTime > startUpTime + 1000) {
				// this gives time for the startup animation to finish
				hideToggles();
				loadLargerImages(e.target);
				timer = setTimeout(hideLargerImageBackup.bind(this, this), 200);
			}
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
		imageItem.querySelector('.art_edit').addEventListener('click', function(e) {
			editTagsClicked(this.closest('.image-item'));
		});
		imageItem.getElementsByTagName('h3')[0].addEventListener('click', function(e) {
			copyStuffToClipboard(this,'name');
		});
		imageItem.getElementsByTagName('h4')[0].addEventListener('click', function(e) {
			if(!this.classList.contains('edit_mode')) {
				copyStuffToClipboard(this, 'tags')
				// toggleThisArtistsTags(this.textContent);
			}
		});
	});
	// gutter
	var gutter = document.getElementById('gutter');
	gutter.addEventListener('mousedown', function(e) {
		e.preventDefault();
		gutterStartPosX = this.offsetLeft;
		mouseStartPosX = e.pageX;
		this.addEventListener('mousemove', movePartition, false);
		window.addEventListener('mouseup', function() {
			gutter.removeEventListener('mousemove', movePartition, false);
		}, false);
	}, false);
}