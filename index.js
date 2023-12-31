//
//
//
//
// global variables
var p1 = performance.now();
var timer;
var artTypes = ['🎨','🧑','🏞️'];
var artTitles = ['artwork','portraits','landscapes'];
var models = [
	// path, short display name, full display name
	['SDXL_1_0','SDXL 1.0','SDXL 1.0 Stability.ai official'],
	['SDXL_DynaVision','XL DynaVision','SDXL DynaVision beta v0.4.1.1'],
	['SDXL_Crystal_Clear','XL CrystalClr','Crystal Clear XL vCCXL'],
];
var secondModelIsSelected = false;
var secondModelSelected = 1;
var initialPosX = -1;
var initialPosY = -1;
var prevScrollTop = -1; // used for lazyLoad
var newPosX = -1;
var newPosY = -1;
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
var tagCountsPermissive = [];
var editedArtists = new Set();
var storingAccessType = 'none';
var missingFiles = '';
// the longer prompt is better for non-photographers
var promptStyleWords = ['artwork in the style of','by|||']
const lowCountThreshold = 3;
const unloadedImgSrc = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAkA4JaQAA3AA/vgfgAA='; // a 1x1 pixel
const maxAristsToBeLoaded = 50; // each artist has 6 images, 3 per model
const artistLoadingChunk = 15; // artists loaded per lazy load call
const missingInterval = setInterval(checkMissingInterval, 5000);
var imageItemUnloadQueue = [];
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
	makeConcatenatedTagSet();
	await loadEditedArtists();
	insertArtists();
	insertModels();
	insertCheckboxesFromArtistsData();
	insertCheckboxesFromCategories();
	await loadCheckboxesState();
	showHideCategories();
	await loadOptionsState();
	await loadFavoritesState();
	blurUnblurNudity();
	hideAllArtists();
	unhideBasedOnPermissiveSetting();
	sortArtists();
	rotatePromptsImages();
	updateArtistsImgSrc(false,false);
	updateTags('start');
	makeStyleRuleForDrag();
	// teasePartition();
	promptBuilderAddArtist(true);
	updatePromptBuilderParts();
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

function makeConcatenatedTagSet() {
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
						// if this is a local file, then update artistsData with the saved edits
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
	let container = document.getElementById('image-container');
	// artistsData is defined in the artists_and_tags.js file
	for(i=0, il=artistsData.length; i<il; i++) {
		var artist = artistsData[i];
		var last = artist[0];
		var first = artist[1];
		var tags2 = artist[2].replaceAll('|', ', '); // for display
		// artists can have a tag in the format of "added-YYYY-MM"
		// we want that to show up as a filter, but not on the artist card
		tags2 = tags2.replace(/, added-(\d|-)*/g,'');
		var itemDiv = document.createElement('div');
		itemDiv.className = 'image-item';
		itemDiv.dataset.tagList = artist[2].toLowerCase();
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
		//
		var holder = document.createElement('div');
		var imgTools = document.createElement('div');
		imgTools.className = 'imgTools';
		//
		var artPrev = document.createElement('div');
		artPrev.className = 'art_prev';
		var artPrevSpan = document.createElement('span');
		artPrevSpan.textContent = '🎨';
		artPrevSpan.title = 'showing artwork'
		artPrev.appendChild(artPrevSpan);
		imgTools.appendChild(artPrev);
		//
		var artStar = document.createElement('div');
		artStar.className = 'art_star';
		var artStarSpan = document.createElement('span');
		artStarSpan.textContent = '⭐️';
		artStarSpan.title = 'toggle favorite';
		artStar.appendChild(artStarSpan);
		imgTools.appendChild(artStar);
		//
		var artNext = document.createElement('div');
		artNext.className = 'art_next';
		var artNextSpan = document.createElement('span');
		artNextSpan.textContent = '🎨';
		artNextSpan.title = 'showing artwork';
		artNext.appendChild(artNextSpan);
		imgTools.appendChild(artNext);
		//
		var artEdit = document.createElement('div');
		artEdit.className = 'art_edit';
		var artEditSpan = document.createElement('span');
		artEditSpan.textContent = '✍️';
		artEditSpan.title = 'toggle tag edit mode';
		artEdit.appendChild(artEditSpan);
		imgTools.appendChild(artEdit);
		//
		var artSearch = document.createElement('a');
		artSearch.className = 'art_search';
		artSearch.href = 'https://www.bing.com/images/search?q=' + artist[1].replace(' ','+') + '+' + artist[0].replace(' ','+') + '+artist';
		artSearch.target = '_blank';
		artSearch.title = 'Bing image search';
		var artSearchSpan = document.createElement('span');
		artSearchSpan.textContent = '🌐';
		artSearch.appendChild(artSearchSpan);
		imgTools.appendChild(artSearch);
		//
		var artSet = document.createElement('div');
		artSet.className = 'art_set';
		var artSetSpan = document.createElement('span');
		artSetSpan.textContent = 'A: ' + models[0][1];
		artSetSpan.title = 'showing ' + models[0][2];
		artSet.appendChild(artSetSpan);
		imgTools.appendChild(artSet);
		//
		holder.appendChild(imgTools);
		var imgBox0 = document.createElement('div');
		imgBox0.className = 'imgBox';
		imgBox0.dataset.model = 0;
		var imgArtwork = document.createElement('img');
		var imgPortrait = document.createElement('img');
		var imgLandscape = document.createElement('img');
		var modelName = document.createElement('span');
		imgArtwork.className = 'img img_artwork';
		imgPortrait.className = 'img img_portrait hidden';
		imgLandscape.className = 'img img_landscape hidden';
		modelName.className = 'img model_name hidden';
		imgArtwork.src = unloadedImgSrc;
		imgPortrait.src = unloadedImgSrc;
		imgLandscape.src = unloadedImgSrc;
		imgBox0.appendChild(imgArtwork);
		imgBox0.appendChild(imgPortrait);
		imgBox0.appendChild(imgLandscape);
		let modelNameSpan = document.createElement('span');
		modelNameSpan.appendChild(document.createElement('strong'));
		modelNameSpan.querySelector('strong').appendChild(document.createTextNode('Model:'));
		modelNameSpan.appendChild(document.createElement('br'));
		modelNameSpan.appendChild(document.createTextNode(models[0][2]));
		modelName.appendChild(modelNameSpan);
		imgBox0.appendChild(modelName);
		holder.appendChild(imgBox0);
		//
		let imgBox1 = imgBox0.cloneNode(true);
		imgBox1.classList.add('hidden');
		imgBox1.dataset.model = 1;
		imgBox1.querySelector('.model_name span').childNodes[2].nodeValue = models[secondModelSelected][2];
		holder.appendChild(imgBox1);
		//
		if(artist[3]) {
			itemDiv.dataset.deprecated = true;
			var deprecatedSpan = document.createElement('span');
			deprecatedSpan.textContent = 'this artist is unknown to SDXL - more info in the help ⁉️'
			deprecatedSpan.className = 'deprecated';
			imgBox0.appendChild(deprecatedSpan);
		}
		//
		itemDiv.appendChild(holder);
		container.appendChild(itemDiv);
	}
}

function getArtistsByDistanceFromMiddle() {
	// visible artists based on the distance from the center with current scroll
	// sort these to the top add add non-deprecated hidden artists after that
	let imageItemsVisible = Array.from(document.querySelectorAll('.image-item:not(.hidden)'));
	let artistsAreaCenter = (document.getElementById('rows').clientHeight / 2) - 300;
	let middleItem = null;
	for (let item of imageItemsVisible) {
		// get rect!
		let rect = item.getBoundingClientRect();
		if (rect.top > artistsAreaCenter) {
			if (!middleItem || middleItem.getBoundingClientRect().top > rect.bottom) {
				middleItem = item;
			}
		}
	}
	if(middleItem !== null) {
		let middleItemTop = middleItem.getBoundingClientRect().top;
		imageItemsVisible.sort((a, b) => {
			let aY = a.getBoundingClientRect().top;
			let bY = b.getBoundingClientRect().top;
			return Math.abs(aY - middleItemTop) - Math.abs(bY - middleItemTop);
		});
	}
	return imageItemsVisible;
}

function updateArtistsImgSrc(filteredImageItems,onlySecondModel) {
	if(filteredImageItems == false) {
		// initial page load
		filteredImageItems = getArtistsByDistanceFromMiddle();
		let imageItemsHidden = Array.from(document.querySelectorAll('.image-item.hidden'))
			.filter(item => !item.dataset.deprecated);
		// if not enough visible artists, load hidden, unloaded, non-deprecated artists
		filteredImageItems = filteredImageItems.concat(imageItemsHidden).slice(0, maxAristsToBeLoaded);
	}
	// load those artists (update the image src)
	let imagePromises = [];
	filteredImageItems.forEach(function(item){
		let src0 = 'images/' + models[0][0] + '_thumbs/';
		let src1 = 'images/' + models[secondModelSelected][0] + '_thumbs/';
		let firstN = item.querySelector('.firstN').textContent;
		let lastN = item.querySelector('.lastN').textContent;
		// files use accented characters and huggingface stores the files with this encoding
		src0 = encodeURI(src0.normalize("NFD"));
		src1 = encodeURI(src1.normalize("NFD"));
		if(firstN == '') {
			src0 += lastN.replaceAll(' ', '_');
			src1 += lastN.replaceAll(' ', '_');
		} else {
			src0 += firstN.replaceAll(' ', '_') + '_' + lastN.replaceAll(' ', '_');
			src1 += firstN.replaceAll(' ', '_') + '_' + lastN.replaceAll(' ', '_');
		}
		//
		let imgAlt0 = 'artist: ' + firstN + ' ' + lastN + ' - model: ' + models[0][1];
		let imgAlt1 = 'artist: ' +firstN + ' ' + lastN + ' - model: ' + models[secondModelSelected][1];
		//
		let imgBox0 = item.querySelector('.imgBox[data-model="0"]');
		let imgBox1 = item.querySelector('.imgBox[data-model="1"]');
		delete imgBox1.querySelector('.img_artwork').dataset.thumbSrc;
		delete imgBox1.querySelector('.img_portrait').dataset.thumbSrc;
		delete imgBox1.querySelector('.img_landscape').dataset.thumbSrc;
		let imgArray = [];
		if(!onlySecondModel) {
			imgArray.push([imgBox0.querySelector('.img_artwork'), src0 + '-artwork.webp', imgAlt0 + ' - prompt: artwork']);
			imgArray.push([imgBox0.querySelector('.img_portrait'), src0 + '-portrait.webp', imgAlt0 + ' - prompt: portrait']);
			imgArray.push([imgBox0.querySelector('.img_landscape'), src0 + '-landscape.webp', imgAlt0 + ' - prompt: landscape']);
		}
		imgArray.push([imgBox1.querySelector('.img_artwork'), src1 + '-artwork.webp', imgAlt1 + ' - prompt: artwork']);
		imgArray.push([imgBox1.querySelector('.img_portrait'), src1 + '-portrait.webp', imgAlt1 + ' - prompt: portrait']);
		imgArray.push([imgBox1.querySelector('.img_landscape'), src1 + '-landscape.webp', imgAlt1 + ' - prompt: landscape']);
		//
		generateUnloadQueue();
		imgArray.forEach(function(imgDetails) {
			let p = new Promise((resolve, reject) => {
				imgDetails[0].src = imgDetails[1];
				imgDetails[0].alt = imgDetails[2];
				if(imgDetails[0].complete) {
					if(imgDetails[0].classList.contains('img_artwork') &&
						imgDetails[0].closest('.imgBox').dataset.model == '0') {
						lazyUnloadOne();
					}
					resolve();
					return;
				}
				imgDetails[0].onload = (img) => {
					if(imgDetails[0].classList.contains('img_artwork') &&
						imgDetails[0].closest('.imgBox').dataset.model == '0') {
						lazyUnloadOne();
					}
					imgDetails[0].onload = null;
					imgDetails[0].onerror = null;
					resolve();
				};
				imgDetails[0].onerror = (img) => {
					missingFiles += imgDetails[1] + '\n';
					imgDetails[0].onload = null;
					imgDetails[0].onerror = null;
					reject(new Error('Image loading error'));
				};
			});
			imagePromises.push(p);
		});
	});
	Promise.allSettled(imagePromises).then(() => {
	});
}

function lazyLoad() {
	let container = document.getElementById('rows');
	let currentScrollTop = container.scrollTop;
	if(prevScrollTop == -1) {
		// this skips the scroll that's triggered on page load
		prevScrollTop = currentScrollTop;
		return;
	}
	let scrollDirection = currentScrollTop > prevScrollTop ? 'down' : 'up';
	let scrollAmount = Math.abs(currentScrollTop - prevScrollTop);
	let lookAhead = 750;
	if(scrollAmount > lookAhead) {
		lookAhead = scrollAmount;
	}
	let imageItems = Array.from(container.querySelectorAll('.image-item:not(.hidden)'));
	// look for any visible unloaded images ahead in either scroll direction by the lookAhead amount
	unloadedItemsInRange = imageItems.filter(item => {
		let itemMid = item.getBoundingClientRect().top + (item.clientHeight / 2);
		let imgSrc = item.querySelector('img').src;
		return imgSrc.indexOf(unloadedImgSrc) > -1 &&
			itemMid > 0 - lookAhead &&
			itemMid < container.clientHeight + lookAhead;
	});
	if(unloadedItemsInRange.length > 0) {
		let itemsToBeLoaded;
		// get all unloaded images in the scroll direction, by closest
		// it's already sorted top to bottom
		if (scrollDirection === 'down') {
			itemsToBeLoaded = imageItems.filter(item => {
				let itemMid = item.getBoundingClientRect().top + (item.clientHeight / 2);
				let imgSrc = item.querySelector('img').src;
				return imgSrc.indexOf(unloadedImgSrc) > -1 &&
					itemMid + currentScrollTop > currentScrollTop;
			});
			imageItems.reverse();
		} else {
			itemsToBeLoaded = imageItems.filter(item => {
				let itemMid = item.getBoundingClientRect().top + (item.clientHeight / 2);
				let imgSrc = item.querySelector('img').src;
				return imgSrc.indexOf(unloadedImgSrc) > -1 &&
					itemMid + currentScrollTop < currentScrollTop;
			});
			itemsToBeLoaded = itemsToBeLoaded.reverse();
		}
		itemsToBeLoaded = itemsToBeLoaded.slice(0, artistLoadingChunk);
		// if we don't have enough in the forward direction work backwards
		// for reasons I haven't figured out, sometimes the src update fails
		// yet promise.allSettled doesn't fire, so we load up to the max each time
		let allLoadedImageItems = Array.from(document.querySelectorAll('.image-item'));
		allLoadedImageItems = allLoadedImageItems.filter(item => {
			let imgSrc = item.querySelector('img').src;
			return imgSrc.indexOf(unloadedImgSrc) == -1;
		});
		let i = 0;
		while(itemsToBeLoaded.length < (maxAristsToBeLoaded - allLoadedImageItems.length)) {
			itemsToBeLoaded.push(imageItems[i]);
			i++;
		}
		// slice to a chunk-size and load
		updateArtistsImgSrc(itemsToBeLoaded,false);
	}
	prevScrollTop = currentScrollTop;
}

function generateUnloadQueue() {
	// there's no way to predict which artists are best to unload
	// so pick a random chunk out of loaded, hidden, non-deprecated artists
	let imageItemsHidden = Array.from(document.querySelectorAll('.image-item.hidden:not([data-deprecated="true"]'));
	imageItemsHidden = imageItemsHidden.filter(item => {
		let imgSrc = item.querySelector('img').src;
		return imgSrc.indexOf(unloadedImgSrc) == -1;
	});
	imageItemsHidden.forEach(function(item) {
		item.dataset.randomRank = Math.random();
	});
	imageItemsHidden.sort(function(a, b) {
		var aValue = a.dataset.randomRank;
		var bValue = b.dataset.randomRank;
		return bValue - aValue;
	});
	// in case there aren't enough items, add all loaded, visible, non-deprecated artists, with furthest away sorted first
	let imageItemsVisible;
	imageItemsVisible = getArtistsByDistanceFromMiddle();
	imageItemsVisible.reverse();
	imageItemsVisible = imageItemsVisible.filter(item => {
		let imgSrc = item.querySelector('img').src;
		return imgSrc.indexOf(unloadedImgSrc) == -1;
	});
	imageItemUnloadQueue = imageItemsHidden.concat(imageItemsVisible);
}

function lazyUnloadOne() {
	let allLoadedImageItems = Array.from(document.querySelectorAll('.image-item'));
	allLoadedImageItems = allLoadedImageItems.filter(item => {
		let imgSrc = item.querySelector('img').src;
		return imgSrc.indexOf(unloadedImgSrc) == -1;
	});
	if(allLoadedImageItems.length > maxAristsToBeLoaded) {
		let toBeUnloaded = imageItemUnloadQueue[0];
		imageItemUnloadQueue.shift();
		let images = toBeUnloaded.querySelectorAll('img');
		images.forEach(function(img) {
			img.src = unloadedImgSrc;
			delete img.dataset.thumbSrc;
		});
	}
}

function insertModels() {
	let secondModelSelector = document.querySelector('#second_model select');
	secondModelSelector.innerHTML = '';
	for (var i=1, il=models.length; i<il; i++) {
		// model 0 is the primary model
		let model = models[i];
		let option = document.createElement('option');
		option.value = model[0];
		option.textContent = model[1];
		secondModelSelector.appendChild(option);
	}
}

function setSecondModelSelected(select) {
	for(i=0,il=models.length; i<il; i++) {
		if(models[i][0] === select.value) {
			secondModelSelected = i;
			break;
		}
	}
	secondModelIsSelected = false;
	rotateModelsImages();
	// update images (but only second model)
	updateArtistsImgSrc(false,true);
}

function insertCheckboxesFromArtistsData() {
	var uniqueTags = new Set();
	artistsData.forEach(function(artist) {
		var tags = artist[2].split('|');
		tags.forEach(function(tag) {
			uniqueTags.add(tag.toLowerCase());
		});
	});
	// favorite isn't an artist tag so has to be added
	uniqueTags.add('favorite');
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
	// so it can be referenced by CSS
	document.querySelector('input[name="favorite"').parentNode.id = "favorite_label";
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
			let checkbox = document.querySelector('input[name="'+name+'"]');
			if (checkbox) {
				if(name != 'mode') {
					// a past bug allowed permissiveness to be saved
					// this ensure it's not loaded
					checkbox.checked = state[name];
					styleLabelToCheckbox(checkbox);
				}
				if(name != 'mode'
					&& name != 'use_categories'
					&& name != 'low_count'
					&& name != 'deprecated'
					&& name != 'nudity') {
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
	if(document.querySelector('input[name="mode"]').checked) {
		// while in strict mode, don't save selections
		if(checkbox.name != 'check-all' && checkbox.name != 'mode') {
			storeItemBasedOnAccessType('tagsChecked',false,checkbox.name,checkbox.checked);
		}
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
	let prevButtons = document.querySelectorAll('.art_prev span');
	prevButtons.forEach(function(span) {
		span.textContent = artTypes[imgTypeShown];
		span.title = 'showing ' + artTitles[imgTypeShown];
	});
	let nextButtons = document.querySelectorAll('.art_next span');
	nextButtons.forEach(function(span) {
		span.textContent = artTypes[imgTypeShown];
		span.title = 'showing ' + artTitles[imgTypeShown];
	});
}

function rotateModelsImages() {
	// hide all imgBoxes
	let visibleImgBoxes = document.querySelectorAll('.imgBox:not(.hidden)');
	visibleImgBoxes.forEach(function(imgBox) {
		imgBox.classList.add('hidden');
	});
	// switch model selection, unhide desired imgBox
	if(secondModelIsSelected) {
		secondModelIsSelected = false;
		visibleImgBoxes = document.querySelectorAll('.imgBox[data-model="0"]');
	} else {
		secondModelIsSelected = true;
		visibleImgBoxes = document.querySelectorAll('.imgBox[data-model="1"]');
	}
	visibleImgBoxes.forEach(function(imgBox) {
		imgBox.classList.remove('hidden');
	});
	// update button
	let artSetSpans = document.querySelectorAll('.art_set span');
	artSetSpans.forEach(function(span) {
		if(secondModelIsSelected) {
			span.textContent = 'B: ' + models[secondModelSelected][1];
			span.title = 'showing ' + models[secondModelSelected][2];
			doAlert('Showing B: ' + models[secondModelSelected][1],0);
		} else {
			span.textContent = 'A: ' + models[0][1];
			span.title = 'showing ' + models[0][2];
			doAlert('Showing A:' + models[0][1],0);
		}
	});
	// update name shown on hover
	let modelName = document.querySelectorAll('.model_name span');
	modelName.forEach(function(span) {
		span.childNodes[2].nodeValue = models[secondModelSelected][2];
	});
}

function updateTags(whoCalled) {
	let delay = 10;
	if(whoCalled == 'start') {
		// delay of 200ms allow checkbox CSS animation to complete
		delay = 200;
	}
	timer = setTimeout(async function() {
		// we defer counts per tag because strict mode is slow
		updateArtistsCountPerTagSlow(whoCalled);
		if(whoCalled == 'start') {
			await loadMostUsedTags();
			sortTags();
			showHideLowCountTags();
			// #toggles has .start from HTML; we shown normal appearance after sorting
			document.querySelector('#toggles').classList.remove('start');
		}
	}, delay);
}

function updateArtistsCountPerTagSlow(whoCalled) {
	let hideDeprecated = document.querySelector('input[name="deprecated"]').checked;
	let isPermissive = document.querySelector('input[name="mode"]').checked;
	let checkboxes = document.querySelectorAll('input[type="checkbox"]');
	if(whoCalled == 'start' || whoCalled == 'permissivenessClick') {
		// permissive mode tag counts don't change based on what's selected
		// so we gather counts based on the data rather than DOM
		// since it's fast, we'll do it for start regardless of permissive setting
		if(whoCalled == 'start') {
			for(i=1,il=tagCategories.length-1; i<il; i++) {
				// skip first category ('important')
				// and skip last category ('other')
				let category = tagCategories[i];
				for(j=1,jl=category.length; j<jl; j++) {
					// skip first item, which is category name
					let tag = category[j];
					let countKnown = 0;
					let countAll = 0;
					for(k=0,kl=artistsData.length; k<kl; k++) {
						let artist = artistsData[k];
						if(artist[2].indexOf(tag) > -1) {
							countAll++;
							if(!artist[3]) {
								countKnown++;
							}
						}
					}
					let arr = [tag,countKnown,countAll];
					tagCountsPermissive.push(arr);
				}
			}
		}
		// write counts to DOM
		let hideLowCount = document.querySelector('input[name="deprecated"]').checked;
		for (i=0, il=tagCountsPermissive.length; i<il; i++) {
			let tag = tagCountsPermissive[i];
			checkbox = document.querySelector('input[name="' + tag[0].toLowerCase() + '"]');
			if(checkbox !== null) {
				// some tags tagCategories aren't found in artistsData
				if(!checkbox.parentNode.classList.contains('top_control')) {
					if(hideLowCount) {
						checkbox.parentNode.querySelector('.count').textContent = ' - ' + tag[1].toLocaleString();
					} else {
						checkbox.parentNode.querySelector('.count').textContent = ' - ' + tag[2].toLocaleString();
					}
				}
			}
		}
		checkboxes.forEach(function(checkbox) {
			checkbox.parentNode.classList.remove('no_matches');
			checkbox.parentNode.querySelector('input').disabled = false;
		});
		updateArtistsCountPerCategory();
	}
	if(!isPermissive) {
		// strict mode updates the counts with every checkbox change
		// counts depend on what's checked and what's visible
		checkboxes.forEach(function(checkbox) {
			// 'favorite' count is updated elsewhere
			if(checkbox.name != 'favorite') {
				// top controls aren't tags and don't have counts
				if(!checkbox.parentNode.classList.contains('top_control')) {
					let matchingDivs;
					// for each checkbox, only count artists with a tags matching all checked checkboxes
					matchingDivs = document.querySelectorAll('.image-item[data-tag-list*="' + checkbox.name + '"]:not(.hidden)');
					count = matchingDivs.length;
					if(!count) { count = 0; }
					checkbox.parentNode.querySelector('.count').textContent = ' - ' + count.toLocaleString();
					if(count == 0) {
						checkbox.parentNode.classList.add('no_matches');
						checkbox.parentNode.querySelector('input').disabled = true;
					} else {
						checkbox.parentNode.classList.remove('no_matches');
						checkbox.parentNode.querySelector('input').disabled = false;
					}
				}
			}
		});
	}
	let allDivs = document.querySelectorAll('.image-item');
	let hiddenDivs = document.querySelectorAll('.image-item.hidden');
	updateCountOfAllArtistsShown(allDivs, hiddenDivs);
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
		let isFavorited = imageItem.classList.contains('favorite');
		for(i=0,il=tagCategories.length; i<il; i++) {
			if(tagCategories[i].map(tag => tag.toLowerCase()).some(tag => tagList.includes(tag))) {
				counts[i]++;
			}
			if(tagCategories[i][0] == 'important') {
				if(isFavorited) {
					counts[i]++;
				}
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

function blurUnblurNudity() {
	let nudity = document.querySelector('input[name="nudity"]');
	if(nudity.checked) {
		nudity.parentNode.classList.remove('warning');
		let images = document.querySelectorAll('.img');
		images.forEach(function(img){
			img.classList.remove('censored');
		});
	} else {
		nudity.parentNode.classList.add('warning');
		for (let i=0, il=artistsData.length; i<il; i++) {
			let artist = artistsData[i];
			for(j=0,jl=artist[4].length; j<jl; j++) {
				let blurBox = 0;
				let blurModel = artist[4][j][0];
				if(blurModel > 0) { blurBox = 1; }
				let blurImage = artist[4][j][1];
				if(blurImage == 'a') { blurImage = '.img_artwork'; }
				if(blurImage == 'p') { blurImage = '.img_portrait'; }
				if(blurImage == 'l') { blurImage = '.img_landscape'; }
				if(blurModel == secondModelSelected || blurModel == 0) {
					let imageItems = document.querySelectorAll('.image-item');
					for(k=0,kl=imageItems.length; k<kl; k++) {
						// find match in artistsData if first and last names match
						let imageItem = imageItems[k];
						let firstN = imageItem.querySelector('.firstN').textContent;
						let lastN = imageItem.querySelector('.lastN').textContent;
						if(artist[0] == lastN && artist[1] == firstN) {
							let box = imageItem.querySelector('.imgBox[data-model="' + blurBox + '"');
							let image = box.querySelector(blurImage).classList.add('censored');
							break;
						}
					}
				}
			}
		}
	}
}

function toggleCensored(h4) {
	let imageItem = h4.closest('.image-item');
	let firstN = imageItem.querySelector('.firstN').textContent;
	let lastN = imageItem.querySelector('.lastN').textContent;
	for (let i=0, il=artistsData.length; i<il; i++) {
		let artist = artistsData[i];
		if(artist[0] == lastN && artist[1] == firstN) {
			let blurModel = imageItem.querySelector('.imgBox:not(.hidden)').dataset.model;
			if(blurModel == 1) { blurModel = secondModelSelected; }
			let img = imageItem.querySelector('.imgBox:not(.hidden) .img:not(.hidden)');
			let blurImage = '';
			if(img.classList.contains('img_artwork')) { blurImage = 'a'; }
			if(img.classList.contains('img_portrait')) { blurImage = 'p'; }
			if(img.classList.contains('img_landscape')) { blurImage = 'l'; }
			let blurNew = blurModel + blurImage;
			let match = false;
			for(j=0,jl=artist[4].length; j<jl; j++) {
				let blurOld = artist[4][j]
				if(blurNew == blurOld) {
					match = true;
					artist[4].splice(j,1);
					img.classList.remove('censored');
				}
			}
			if(!match) {
				artist[4].push(blurNew);
				img.classList.add('censored');
			}
			break;
		}
	}
}

function hideAllArtists() {
	let imageItems = document.querySelectorAll('.image-item');
	imageItems.forEach(function(imageItem) {
		imageItem.classList.add('hidden');
	});
}

function uncheckedAllStrictMode(isChecked) {
	if(!isChecked) {
		// when entering strict mode, only allow one checked tag, the first one found
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
			styleLabelToCheckbox(checkbox);
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
	if(input.dataset.match !== undefined) {
		event.preventDefault();
		if(event.key === 'Backspace' || event.keyCode === 8) {
			input.value = '';
			delete input.dataset.match;
		} else {
			input.value = input.dataset.match;
		}
	} else {
		let matches = 0;
		let output = document.getElementById('info_search_output');
		output.innerHTML = '';
		let match = '';
		let tags = document.querySelectorAll('#toggles label:not(.top_control):not(.category):not([data-is-in-category="other"]');
		tags.forEach(function(tag) {
			let tagName = tag.querySelector('input').name;
			if(tagName.toLowerCase().indexOf(input.value.toLowerCase()) > -1) {
				let label = tag.cloneNode(true);
				label.addEventListener('change', function(e) {
					toggleMatchingTag(this);
				});
				output.appendChild(label);
				match = tagName;
				matches++;
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
//			sortInfoSearchTags(output);
		}
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
		artist[2] = newTags.join('|');
		// sort censored images array
		artist[4] = artist[4].sort(function(a, b) {
			return a.localeCompare(b);
		});
		let arrayStr = '';
		for (let i=0, il=artist[4].length; i<il; i++) {
			arrayStr += '"' + artist[4][i] + '",';
		}
		arrayStr = arrayStr.substring(0,arrayStr.length-1);
		// output updated artist
		value += '["'+artist[0]+'","'+artist[1]+'","'+artist[2]+'",'+artist[3]+',['+arrayStr+']],\r\n';
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
				// "favorite" tag always stays at top
				if(label.querySelector('input').name != 'favorite') {
					container.appendChild(label);
				}
			}
		});
		// "added" tags always goes to bottom
		labels.forEach(function(label) {
			let name = label.querySelector('input').name;
			if(name.indexOf('added-') > -1) {
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
				if(label) {
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
		// favorite always goes to top of important category
		let importantCategory = document.querySelector('label[data-category-name="important"]');
		let favoriteLabel = document.getElementById('favorite_label');
		importantCategory.after(favoriteLabel);
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
				// "favorite" tag always stays at top
				if(label.querySelector('input').name != 'favorite') {
					container.appendChild(label);
				}
			}
		});
		// "added" tags always goes to bottom
		labels.forEach(function(label) {
			let name = label.querySelector('input').name;
			if(name.indexOf('added-') > -1) {
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
		// favorite always goes to top of important category
		let importantCategory = document.querySelector('label[data-category-name="important"]');
		let favoriteLabel = document.getElementById('favorite_label');
		importantCategory.after(favoriteLabel);
	}
}

async function loadMostUsedTags() {
	// aka the important category
	await loadItemBasedOnAccessType('mustUsedTags').then(state => {
		let mostUsedCategory = document.querySelector('[data-category-name="important"]');
		for(let tag in state) {
			if(state[tag]) {
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
		// favorite is always most used
		let favoriteLabel = document.getElementById('favorite_label');
		favoriteLabel.classList.add('is_most_used');
		favoriteLabel.querySelectorAll('.most_used_indicator')[0].textContent = '';
		updateTagArrayToMatchMostUsed(true,favoriteLabel,'favorite');
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
			document.getElementById('edit_most_used').textContent = 'edit these';
			document.getElementById('layout').classList.remove('edit_mode');
			inputs.forEach(function(input) {
				input.disabled = false;
			});
			let labels = Array.from(document.querySelectorAll('.was_moved'));
			labels.forEach(function(label) {
				// clean up classes added to track moved tags during edit mode
				label.classList.remove('was_moved');
			});
			document.getElementById('toggles').style.width = 'calc(' + gutterEndPercentX + '% + 20px)';
			document.getElementById('gutter').style.left =  gutterEndPercentX + '%';
			document.getElementById('image-container').style.marginLeft = 'calc(' + gutterEndPercentX + '% + 50px)';
			updateArtistsCountPerCategory();
			sortTags();
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
	var favoriteCounter = document.getElementById('favorite_label').querySelector('.count');
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
	} else if(stuff == 'prompt') {
		let prompt_result = document.getElementById('prompt_result').querySelector('div');
		let prompt = prompt_result.innerText.trim();
		prompt = prompt.replace(/(\r\n|\n|\r)/gm, '');
		navigator.clipboard.writeText(prompt)
			.then(() => {
				doAlert('Copied prompt to clipboard!',1);
			})
			.catch(() => {
				doAlert('😭😭 Can\'t access clipboard',1);
			});
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
	var checkAll = document.querySelector('input[name="check-all"]').checked;
	var checkboxes = document.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach(function(checkbox) {
		if(hideLowCount) {
			var classes = checkbox.parentNode.classList;
			if(!classes.contains('category')
				&& !classes.contains('no_matches')
				&& !classes.contains('top_control')) {
				let count = parseInt(checkbox.parentNode.querySelector('.count').textContent.replace(/,/g, '').trim().substring(2),10);
				if(count <= lowCountThreshold) {
					if(checkbox.checked && checkAll == false) {
						// low-count checkboxes that are checked aren't unchecked
						// unless all checkboxes are checked
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
		doAlert('Low-use tag hidden',0);
	}
}

function showLargerImages(imageItem) {
	imageItem.classList.add('hover');
	let images = imageItem.querySelectorAll('img');
	let imagePromises = [];
	images.forEach(function(img){
		if(img.src.indexOf('_thumbs') > -1 && img.dataset.thumbSrc == undefined) {
			// don't try to load if we tried before
			if(!img.dataset.deprecated) {
				let first = img.closest('.image-item').querySelector('.firstN').textContent;
				let last = img.closest('.image-item').querySelector('.lastN').textContent;
				img.dataset.thumbSrc = img.src;
				let model = img.closest('.imgBox').dataset.model;
				let src = 'images/'
				if(model == 0) {
					src += models[0][0] + '/';
				} else {
					src += models[secondModelSelected][0] + '/';
				}
				if(first == '') {
					src += last.replaceAll(' ', '_');
				} else {
					src += first.replaceAll(' ', '_') + '_' + last.replaceAll(' ', '_');
				}
				let p = new Promise((resolve, reject) => {
					if(img.classList.contains('img_artwork')) {
						img.src = src + '-artwork.webp';
					} else if(img.classList.contains('img_portrait')) {
						img.src = src + '-portrait.webp';
					} else if(img.classList.contains('img_landscape')) {
						img.src = src + '-landscape.webp';
					}
					if(img.complete) {
						resolve();
						return;
					}
					img.onload = () => {
						img.onload = null;
						img.onerror = null;
						resolve();
					}
					img.onerror = () => {
						missingFiles += img.src + '\n';
						img.onload = null;
						img.onerror = null;
						reject(new Error('Image loading error'));
					};
				});
				imagePromises.push(p);
			}
		}
	});
	if(imagePromises.length > 0) {
		Promise.allSettled(imagePromises).then(() => {
		});
	}
}

function hideLargerImages(imageItem) {
	imageItem.classList.remove('hover');
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
	let index = stylesheet.insertRule('.image-item.hover .imgBox { width: 40%; }', 0);
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
	document.getElementById('toggles').style.width = 'calc(' + gutterEndPercentX + '% + 20px)';
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

function promptBuilderAddArtist(isStart) {
	let ogPart = document.querySelector('.prompt_artist');
	let part = ogPart.cloneNode(true);
	document.querySelector('#prompt_artist_add').before(part);
	let input = part.querySelector('.prompt_artist_name input');
	input.value = '';
	delete input.dataset.match;
	delete input.dataset.isPhoto;
	input.addEventListener('focus', function(e) {
		this.dataset.hasFocus = 'yes';
		setXPosOfSearchOutput();
	});
	input.addEventListener('keyup', function(e) {
		promptBuilderSearch(this,e);
	});
	input.addEventListener('blur', function(e) {
		// need to give time for search result row click event
		timer = setTimeout(promptBuilderBlur.bind(this, this), 100);
		if(this.dataset.match === undefined) {
			this.value = '';
		}
	});
	let intensity = part.querySelector('.prompt_artist_intensity select');
	intensity.selectedIndex = 'x1';
	intensity.addEventListener('change', function(e) {
		writePrompt();
	});
	let combine = part.querySelector('.prompt_artist_combine select');
	combine.selectedIndex = 'mix';
	combine.addEventListener('change', function(e) {
		writePrompt();
	});
	let remove = part.querySelector('.prompt_artist_remove');
	remove.addEventListener('click', function(e) {
		promptBuilderRemoveArtist(this);
		writePrompt();
	});
	let left = part.querySelector('.prompt_artist_left');
	left.addEventListener('click', function(e) {
		promptBuilderMove(this.parentNode,'left');
		writePrompt();
	});
	let right = part.querySelector('.prompt_artist_right');
	right.addEventListener('click', function(e) {
		promptBuilderMove(this.parentNode,'right');
		writePrompt();
	});
	if(isStart) {
		// start copies then removes the HTML part so that
		// the event listeners don't need defined twice in the code
		ogPart.remove();
	}
	updatePromptBuilderParts();
	writePrompt();
}

function promptBuilderBlur(input) {
	delete input.dataset.hasFocus;
	document.getElementById('prompt_artist_search').classList.remove('show');
	writePrompt();
}

function updatePromptBuilderParts() {
	let count = 1;
	let parts = Array.from(document.querySelectorAll('.prompt_artist'));
	if(parts.length == 1) {
		let part = parts[0];
		let intensity = part.querySelector('.prompt_artist_intensity');
		let combine = part.querySelector('.prompt_artist_combine');
		let left = part.querySelector('.prompt_artist_left');
		let right = part.querySelector('.prompt_artist_right');
		let remove = part.querySelector('.prompt_artist_remove');
		intensity.style.display = 'none';
		combine.style.display = 'none';
		left.style.display = 'none';
		right.style.display = 'none';
		remove.style.display = 'none';
	} else {
		for(i=0,il=parts.length; i<il; i++) {
			let part = parts[i];
			let countEl = part.querySelector('.prompt_artist_count div');
			let intensity = part.querySelector('.prompt_artist_intensity');
			let combine = part.querySelector('.prompt_artist_combine');
			let left = part.querySelector('.prompt_artist_left');
			let right = part.querySelector('.prompt_artist_right');
			let remove = part.querySelector('.prompt_artist_remove');
			countEl.textContent = count;
			count++;
			intensity.style.display = '';
			combine.style.display = '';
			left.style.display = '';
			right.style.display = '';
			remove.style.display = '';
			if(i==0) {
				left.style.display = 'none';
				combine.style.display = 'none';
				if(il==1) {
					right.style.display = 'none';
				}
			} else if(i==il-1) {
				right.style.display = 'none';
			}
		}
	}
}

function promptBuilderMove(part,direction) {
	if(direction == 'left') {
		part.previousElementSibling.before(part);
	} else if(direction == 'right') {
		part.nextElementSibling.after(part);
	}
	updatePromptBuilderParts();
}

function promptBuilderRemoveArtist(removeButton) {
	if(removeButton.textContent.trim() == 'X') {
		removeButton.textContent = 'again';
		timer = setTimeout(cleanupRemoveButton.bind(this, removeButton), 1000);
	} else {
		removeButton.parentNode.remove();
		updatePromptBuilderParts();
	}
}

function cleanupRemoveButton(removeButton) {
	removeButton.textContent = 'X';
}

function promptBuilderFillArtist(item,e) {
	var name = item.closest('.image-item').getElementsByClassName('firstN')[0].textContent +
	' ' + item.closest('.image-item').getElementsByClassName('lastN')[0].textContent;
	let inputs = Array.from(document.querySelectorAll('.prompt_artist_name input'));
	for(i=0,il=inputs.length; i<il; i++) {
		if(inputs[i].value == '') {
			inputs[i].value = name;
			promptBuilderSearch(inputs[i],e);
			break;
		}
	}
}

function promptBuilderHide() {
	document.querySelector('#prompt_builder').classList.remove('show');
}

function promptBuilderShow() {
	document.querySelector('#prompt_builder').classList.add('show');
}

function promptBuilderSearch(input,event) {
	if(input.dataset.match !== undefined) {
		event.preventDefault();
		if(event.key === 'Backspace' || event.keyCode === 8) {
			input.value = '';
			delete input.dataset.match;
			delete input.dataset.isPhoto;
		} else {
			input.value = input.dataset.match;
		}
	} else {
		let matches = 0;
		let output = document.getElementById('prompt_artist_search');
		output.innerHTML = '';
		let match = '';
		let isPhoto = false;
		for(i=0,il=artistsData.length; i<il; i++) {
			let artistName = artistsData[i][1] + ' ' + artistsData[i][0];
			if(artistName.toLowerCase().indexOf(input.value.toLowerCase()) > -1) {
				let outputRow = document.createElement('div');
				outputRow.textContent = artistName;
				outputRow.addEventListener('click', function(e) {
					let input = document.querySelector('input[data-has-focus="yes"]');
					input.value = this.textContent;
					promptBuilderSearch(input,e);
					input.focus();
				});
				output.appendChild(outputRow);
				matches++;
				match = artistName;
				if(artistsData[i][2].toLowerCase().indexOf('photography') > -1) {
					isPhoto = true;
				}
			}
		}
		if(matches == 0) {
			let noneFound = document.createElement('div');
			noneFound.textContent = 'no matching names';
			output.appendChild(noneFound);
		} else if(matches == 1) {
			input.value = match;
			event.preventDefault();
			input.dataset.match = match;
			if(isPhoto) {
				input.dataset.isPhoto = 'yes';
			} else {
				input.dataset.isPhoto = 'no';
			}
			output.classList.remove('show');
			writePrompt();
		} else {
			output.classList.add('show');
			promptBuilderSearchSortOutput(output);
		}
	}
}

function setXPosOfSearchOutput() {
	let input = document.querySelector('.prompt_artist input:focus');
	if(input) {
		let output = document.getElementById('prompt_artist_search');
		let xPos = input.getBoundingClientRect().left;
		output.style.left = xPos + 'px';
	}
}

function promptBuilderSearchSortOutput(output) {
	let rows = Array.from(output.querySelectorAll('div'));
	rows.sort(function(a, b) {
		var aValue = a.textContent;
		var bValue = b.textContent;
		return aValue.localeCompare(bValue);
	});
	rows.forEach(function(row) {
		output.appendChild(row);
	});
}


function writePrompt() {
	let prompt = '';
	let edited = true;
	let editable = document.querySelector('#prompt_result_editable').textContent.trim();
	let editMe = ['you can edit me','pick an artist, then edit me',''];
	if(editable == editMe[0] || editable == editMe[1] || editable == editMe[2]) {
		edited = false;
	}
	let parts = Array.from(document.querySelectorAll('.prompt_artist'));
	let nextCombine = 'start';
	let startAt = 0;
	let missingName = false;
	if(parts.length == 1) {
		let part = parts[0];
		let name = part.querySelector('input').value;
		if(name == '') {
			missingName = true;
		}
		let style = promptStyleWords[0];
		let isPhoto = part.querySelector('input').dataset.isPhoto;
		if(isPhoto == 'yes') {
			style = promptStyleWords[1];
		}
		if(name != '') {
			prompt = style + ' ' + name;
		}
	} else {
		for(pCount=1,pLength=parts.length; pCount<pLength; pCount++) {
			// i starts at 1 because first part's combine value is ignored
			let part = parts[pCount];
			let thisCombine = part.querySelector('.prompt_artist_combine select').value;
			if(parts[pCount+1]) {
				if(nextCombine == 'start') {
					nextCombine = parts[pCount+1].querySelector('.prompt_artist_combine select').value;
				}
			} else {
				nextCombine = 'end';
			}
			if(thisCombine != nextCombine || nextCombine == 'end' || thisCombine == 'swap') {
				if(thisCombine == 'loop') {
					prompt = '[' + prompt;
				} else if(thisCombine == 'swap') {
					prompt = '[' + prompt;
				}
				// loop through artists with matching combine
				for(j=startAt,jl=pCount+1; j<jl; j++) {
					part = parts[j];
					let name = part.querySelector('input').value;
					if(name == '') {
						missingName = true;
						break;
					}
					let style = promptStyleWords[0];
					let isPhoto = part.querySelector('input').dataset.isPhoto;
					if(isPhoto == 'yes') {
						style = promptStyleWords[1];
					}
					let intensityNum = parseInt(part.querySelector('.prompt_artist_intensity select').value);
					// repeat based on intensity
					for(k=0,kl=intensityNum; k<kl; k++) {
						if(thisCombine == 'add') {
							prompt += style + ' ' + name + ',';
						} else if(thisCombine == 'loop') {
							prompt += style + ' ' + name + '|';
						} else if(thisCombine == 'swap') {
							prompt += style + ' ' + name + ',';
						}
					}
					if(thisCombine == 'swap') {
						prompt = prompt.substring(0,prompt.length-1);
						prompt += ':';
					}
				}
				prompt = prompt.substring(0,prompt.length-1);
				if(thisCombine == 'loop') {
					prompt += ']'
				} else if(thisCombine == 'swap') {
					prompt += ':0.5]'
				}
				startAt = pCount;
			}
		}
	}
	if(missingName) {
		// no artists are selected
		if(!edited) {
			editable = editMe[1];
		}
		prompt = '<span id="prompt_result_editable" contenteditable="true">' + editable + '</span>';
	} else {
		// 1 or more artists selected
		if(!edited) {
			editable = editMe[0];
		}
		prompt = formatPrompt(prompt);
		prompt = '<span><b>(</b>' + prompt + '<b>:1.5)</b></span>, ' +
			'<span><b>(</b>an image<b>:0.5)</b>, </span>' +
			'<span><b>(</b><span id="prompt_result_editable" contenteditable="true">' + editable + '</span><b>:1.0)</b></span>';
	}
	document.querySelector('#prompt_result div').innerHTML = prompt;
	document.getElementById('prompt_result_editable').addEventListener('blur', function(e) {
		let str = this.innerText;
		this.innerHTML = str;
	});

}

function formatPrompt(prompt) {
	let promptArr = [];
	let style = promptStyleWords[0];
	if(prompt.indexOf(promptStyleWords[0]) > -1 && prompt.indexOf(promptStyleWords[1]) < 0) {
		// prompt contains only non-photographers
		// so use the style words for st
		promptArr = prompt.split(promptStyleWords[0]);
	/*
	} else if(prompt.indexOf(promptStyleWords[0]) < 0 && prompt.indexOf(promptStyleWords[1]) > -1) {
		// prompt contains only photographers
		promptArr = prompt.split(promptStyleWords[1]);
		style = promptStyleWords[1];
	*/
	} else {
		// prompt contains only both photographers and non
		// using the shorter prompt event though it makes the style weaker
		// because it uses for fewer tokens for multiple artists
		let regStr = new RegExp(promptStyleWords[0],'g');
		prompt = prompt.replace(regStr,promptStyleWords[1]);
		promptArr = prompt.split(promptStyleWords[1]);
		style = promptStyleWords[1];

	}
	if(promptArr.length > 0) {
		prompt = style + ' ';
		for(i=0,il=promptArr.length; i<il; i++) {
			prompt += promptArr[i];
		}
	}
	prompt = prompt.replace('|||','');
	prompt = prompt.replace(/\[ |\[/g,'<i>[</i>');
	prompt = prompt.replace(/\| |\|/g,'<i>|</i>');
	prompt = prompt.replace(/: |:/g,'<i>:</i>');
	prompt = prompt.replace(/]/g,'<i>]</i>');
	return prompt;
}

function checkMissingInterval() {
	// if the broken image is cached, the error event won't fire
	// so we periodically check naturalHeight
	// if 0, the image is broken and make it prettier
	let images = document.querySelectorAll('.img');
	images.forEach(function(img) {
		if(img.alt !== undefined) {
			// because alt is added async
			let str = 'Missing image >>> ';
			if(img.naturalHeight == 0) {
				if(img.alt.indexOf(str) < 0) {
					img.alt = str + img.alt;
					img.classList.add('missing');
				}
			} else {
				img.alt = img.alt.replace(str,'');
				img.classList.remove('missing');
			}
		}
	})
}

function debouncer(func, delay) {
	let debounceTimer;
	return function() {
		const context = this;
		const args = arguments;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => func.apply(context, args), delay);
	};
}

/*
**
**
**
**
**
**
**
**
**
**
**
**
**
**
**
**
**
*/

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
				updateTags('click');
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
					updateTags('click');
				});
			} else if(checkbox.name == 'mode') {
				checkbox.addEventListener('change', function(e) {
					uncheckedAllStrictMode(this.checked);
					hideAllArtists();
					unhideBasedOnPermissiveSetting();
					updateTags('permissivenessClick');
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
					updateTags('click');
				});
			} else if(checkbox.name == 'nudity') {
				checkbox.addEventListener('change', function(e) {
					blurUnblurNudity();
				});
			}
		}
		// all checkboxes
		checkbox.addEventListener('change', function(e) {
			styleLabelToCheckbox(this);
			clearSelection();
			storeCheckboxState(e.target);
			window.setTimeout(function() {
				updateArtistsImgSrc(false,false);
			})
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
		window.setTimeout(function() {
			updateArtistsImgSrc(false,false);
		})
		highlightSelectedOption('sortAA');
		storeOptionsState();
	});
	var sortAR = document.getElementById('sortAR');
	sortAR.addEventListener('click', function(e) {
		sortArtistsByRandom();
		window.setTimeout(function() {
			updateArtistsImgSrc(false,false);
		})
		highlightSelectedOption('sortAR');
		storeOptionsState();
	});
	// second model selector
	let secondModelSelector = document.querySelector('#second_model select');
	secondModelSelector.addEventListener('change', function(e) {
		setSecondModelSelected(this);
		blurUnblurNudity();
	});

	// most used mode
	var mostUsed = document.getElementById('edit_most_used');
	mostUsed.addEventListener('click', function(e) {
		enterExitEditMostUsedMode();
	});
	var labels = document.querySelectorAll('label');
	Array.from(labels).forEach(function(label) {
		let name = label.querySelector('input').name;
		if(name != 'favorite') {
			// favorite can't be removed from most used
			label.addEventListener('click', function(e) {
				if(editMostUsedMode) {
					addRemoveIsMostUsed(this);
					storeMostUsedState(this);
				}
			});
		}
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
				showLargerImages(e.target);
				timer = setTimeout(hideLargerImageBackup.bind(this, this), 200);
			}
		});
		imageItem.addEventListener('mouseleave', function(e) {
			showToggles();
			hideLargerImages(e.target);
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
		imageItem.querySelector('.art_set').addEventListener('click', function() {
			rotateModelsImages();
			blurUnblurNudity();
		});
		imageItem.getElementsByTagName('h3')[0].addEventListener('click', function(e) {
			copyStuffToClipboard(this,'name');
			promptBuilderFillArtist(this,e);
		});
		imageItem.getElementsByTagName('h4')[0].addEventListener('click', function(e) {
			if(!this.classList.contains('edit_mode')) {
				copyStuffToClipboard(this, 'tags')
				// toggleCensored(this);
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
	// prompt builder
	var prompt_builder = document.getElementById('prompt_builder');
	prompt_builder.addEventListener('click', function(e) {
		promptBuilderShow();
	});
	var prompt_builder_hide = document.getElementById('prompt_builder_hide');
	prompt_builder_hide.addEventListener('click', function(e) {
		promptBuilderHide();
		e.stopPropagation();
	});
	var prompt_result_copy = document.getElementById('prompt_result_copy');
	prompt_result_copy.addEventListener('click', function(e) {
		copyStuffToClipboard(null,'prompt');
	});
	var prompt_artist_add = document.getElementById('prompt_artist_add');
	prompt_artist_add.addEventListener('click', function(e) {
		promptBuilderAddArtist();
	});
	var prompt_selector_div = document.querySelector('#prompt_selector > div');
	prompt_selector_div.addEventListener('scroll', debouncer(function() {
		setXPosOfSearchOutput();
	}, 100));
	// lazy loader
	var rows = document.querySelector('#rows');
	rows.addEventListener('scroll', debouncer(function() {
		lazyLoad();
	}, 50));
}