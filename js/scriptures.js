/*
File: scriptures.js
Author: Matthew Hamilton
Date: Winter 2019

*/

/*property
    Animation, DROP, Marker, animation, books, classKey, clearTimeout, content,
    exec, forEach, fullName, getAttribute, getElementById, google, gridName,
    hash, href, id, init, innerHTML, lat, length, lng, log, map, maps,
    maxBookId, minBookId, numChapters, onerror, onHashChanged, onload, open,
    parse, position, push, querySelectorAll, responseText, send, setMap,
    setTimeout, slice, split, status, substring, title, tocName,
*/

/*global console, google, map, window */

/*jslint
    browser: true
    long: true */

const Scriptures = (function () {

    /*
    * CONSTANTS
    */
    const BOTTOM_PADDING = "<br /><br />";
    const CLASS_BOOKS = "books";
    const CLASS_VOLUME = "volume";
    const DIV_BREADCRUMBS = "crumbs";
    const DIV_SCRIPTURES = "scriptures";
    const DIV_SCRIPTURES_NAVIGATOR = "scripnav";
    const INDEX_PLACENAME = 2;
    const INDEX_LATITUDE = 3;
    const INDEX_LONGITUDE = 4;
    const INDEX_PLACE_FLAG = 11;
    const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
    const MAX_RETRY_DELAY = 5000;
    const REQUEST_GET = "GET";
    const REQUEST_STATUS_OK = 200;
    const REQUEST_STATUS_ERORR = 400;
    const TAG_HEADER5 = "h5";
    const TAG_LIST_ITEM = "li";
    const TAG_UNORDERED_LIST = "ul";
    const TEXT_TOP_LEVEL = "The Scriptures";
    const URL_BOOKS = "https://scriptures.byu.edu/mapscrip/model/books.php";
    const URL_SCRIPTURES = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";
    const URL_VOLUMES = "https://scriptures.byu.edu/mapscrip/model/volumes.php";

    /*
    * PRIVATE VARIABLES
    */
    let books;
    let gmMarkers = [];
    let requestedBreadcrumbs;
    let retryDelay = 500;
    let volumes;

    /*
    * PRIVATE METHOD DECLARATIONS
    */
    let addMarker;
    let ajax;
    let bookChapterValid;
    let booksGrid;
    let booksGridContent;
    let breadcrumbs;
    let cacheBooks;
    let changeHash;
    let clearMarkers;
    let encodedScriptureUrlParameters;
    let getScriptureCallback;
    let getScriptureFailed;
    let htmlAnchor;
    let htmlDiv;
    let htmlHeader5;
    let htmlElement;
    let htmlHashLink;
    let htmlLink;
    let init;
    let navigateBook;
    let navigateChapter;
    let navigateHome;
    let nextChapter;
    let onHashChanged;
    let previousChapter;
    let setupMarkers;
    let titleForBookChapter;
    let volumeForId;
    let volumesGridContent;

    /*
    * PRIVATE METHODS
    */
    addMarker = function (placename, latitude, longitude) {
        // NEEDS WORK - check to see if we already have this latitude/longitude in the gmMarkers array
            // if so, merge this place name

        //NEEDS WORK - create the marker
        let marker = new google.maps.Marker({
            position: {lat: latitude, lng: longitude},
            map: map,
            title: placename,
            animation: google.maps.Animation.DROP
        });

        gmMarkers.push(marker);
    };

    ajax = function (url, successCallback, failureCallback, skipParse) {
        let request = new XMLHttpRequest();

        request.open(REQUEST_GET, url, true);

        request.onload = function () {
            if (request.status >= REQUEST_STATUS_OK && request.status < REQUEST_STATUS_ERORR) {
                let data;

                if (skipParse) {
                    data = request.responseText;
                } else {
                    data = JSON.parse(request.responseText);
                }

                if (typeof successCallback === "function") {
                    successCallback(data);
                }
            } else {
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };

        request.onerror = failureCallback;
        request.send();
    };

    bookChapterValid = function (bookId, chapter) {
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };

    booksGrid = function (volume) {
        return htmlDiv({
            classKey: CLASS_BOOKS,
            content: booksGridContent(volume)
        });
    };

    booksGridContent = function (volume) {
        let gridContent = "";

        volume.books.forEach(function (book) {
            gridContent += htmlLink({
                classKey: "btn",
                id: book.id,
                href: `#${volume.id}:${book.id}`,
                content: book.gridName
            });
        });

        return gridContent;
    };

    breadcrumbs = function (volume, book, chapter) {
        let crumbs;

        if (volume === undefined) {
            crumbs = htmlElement(TAG_LIST_ITEM, TEXT_TOP_LEVEL);
        } else {
            crumbs = htmlElement(TAG_LIST_ITEM, htmlHashLink("", TEXT_TOP_LEVEL));

            if (book === undefined) {
                crumbs += htmlElement(TAG_LIST_ITEM, volume.fullName);
            } else {
                crumbs += htmlElement(TAG_LIST_ITEM, htmlHashLink(`${volume.id}`, volume.fullName));

                if (chapter === undefined || chapter <= 0) {
                    crumbs += htmlElement(TAG_LIST_ITEM, book.tocName);
                } else {
                    crumbs += htmlElement(TAG_LIST_ITEM, htmlHashLink(`${volume.id},${book.id}`, book.tocName));
                    crumbs += htmlElement(TAG_LIST_ITEM, chapter);
                }
            }
        }

        return htmlElement(TAG_UNORDERED_LIST, crumbs);
    };

    cacheBooks = function (callback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };

    changeHash = function (volumeId, bookId, chapter) {
        let newHash = "";

        if (volumeId !== undefined) {
            newHash += volumeId;

            if (bookId !== undefined) {
                newHash += `:${bookId}`;

                if (chapter !== undefined) {
                    newHash += `:${chapter}`;
                }
            }
        }
        location.hash = newHash;
    };

    clearMarkers = function () {
        gmMarkers.forEach(function (marker) {
            marker.setMap(null);
        });
    };

    encodedScriptureUrlParameters = function (bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";

            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined && isJst) {
                options += "&jst=JST";
            }

            //  return SCRIPTURES_URL + "?book=" + bookId + "&chap=" + chapter +
            //  "&verses=" + options;

            return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses=${options}`;
        }
    };

    getScriptureCallback = function (chapterHtml) {
        document.getElementById(DIV_SCRIPTURES).innerHTML = chapterHtml;
        document.getElementById(DIV_BREADCRUMBS).innerHTML = requestedBreadcrumbs;
        setupMarkers();
    };

    getScriptureFailed = function () {
        console.log("Warning: unable to receive scripture content from server.");
    };

    htmlAnchor = function (volume) {
        return `<a name="v${volume.id}" />`;
    };

    htmlDiv = function (parameters) {
        let classString = "";
        let contentString = "";
        let idString = "";

        if (parameters.classKey !== undefined) {
            classString = ` class="${parameters.classKey}"`;
        }

        if (parameters.content !== undefined) {
            contentString = parameters.content;
        }

        if (parameters.id !== undefined) {
            idString = ` id="${parameters.id}"`;
        }

        return `<div${idString}${classString}>${contentString}</div>`;
    };

    htmlElement = function (tagName, content) {
        return `<${tagName}>${content}</${tagName}>`;
    };

    htmlHashLink = function (hashArguments, content) {
        return `<a href="javascript:void(0)" onclick="Scriptures.changeHash(${hashArguments})">${content}</a>`;
    };

    htmlLink = function (parameters) {
        let classString = "";
        let contentString = "";
        let hrefString = "";
        let idString = "";

        if (parameters.classKey !== undefined) {
            classString = ` class="${parameters.classKey}"`;
        }

        if (parameters.content !== undefined) {
            contentString = parameters.content;
        }

        if (parameters.href !== undefined) {
            hrefString = ` href="${parameters.href}"`;
        }

        if (parameters.id !== undefined) {
            idString = ` id="${parameters.id}"`;
        }

        return `<a${idString}${classString}${hrefString}>${contentString}</a>`;
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax(URL_BOOKS, function (booksObject) {
            books = booksObject;
            booksLoaded = true;

            if (volumesLoaded) {
                cacheBooks(callback);
            }
        });

        ajax(URL_VOLUMES, function (volumesArray) {
            volumes = volumesArray;
            volumesLoaded = true;

            if (booksLoaded) {
                cacheBooks(callback);
            }
        });
    };

    navigateBook = function (bookId) {
        let book = books[bookId];
        let volume;

        if (book !== undefined) {
            volume = volumeForId(book.parentBookId);
        }

        document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({content: bookId});
        document.getElementById(DIV_BREADCRUMBS).innerHTML = breadcrumbs(volume, book);
        /*

        NEEDS WORK: generate HTML that looks like this (to use Liddle's styles.css):

        <div id = "scripnav" OR DIV_SCRIPTURES_NAVIGATOR>
            <div class="volume"><h5>book.fullName</h5></div>
            <a class="btn chapter" id="1" href="#0:bookId:1">1</a>
            <a class="btn chapter" id="2" href="#0:bookId:2">2</a>
            ...
            <a class="btn chapter" id="49" href="#0:bookId:49">49</a>
            <a class="btn chapter" id="49" href="#0:bookId:50">50</a>
        </div>

        (plug in the right string for book.fullName and bookId in the example above)

        Logic for this method:
        1. Get the book for the given bookId.
        2. If the book has no numbered chapters, call navigateChapter() for that book ID
            and chapter 0.
        3. Else if the book has exactly one chapter, call navigateChapter() for that book
            ID and chapter 1.
        4. Else generate the HTML to mach the example above.

        */
    };

    navigateChapter = function (bookId, chapter) {
        if (bookId !== undefined) {
            let book = books[bookId];
            let volume = volumes[book.parentBookId - 1];

            requestedBreadcrumbs = breadcrumbs(volume, book, chapter);
            //used for breadcrumbs, but not necessary

            console.log(nextChapter(bookId, chapter));

            ajax(encodedScriptureUrlParameters(bookId, chapter),
                    getScriptureCallback,
                    getScriptureFailed,
                    true);

            //old dummy code below:
            //document.getElementById("scriptures").innerHTML = "<div>Chapter " + chapter + "</div>";
        }
    };

    navigateHome = function (volumeId) {
        /*let navContents = "<div id=\"scriptnav\">";

        volumes.forEach(function (volume) {
            if (volumeId === undefined || volumeId === volume.id) {
                navContents += "<div class=\"volume\"><a name=\"v" + "\"/><h5>" +
                        volume.fullName + "</h5></div><div class=\"books\">";

                volume.books.forEach(function (book) {
                    navContents += "<a class=\"btn\" id\"" + book.id + "\" href=\"#" +
                            volume.id + ":" + book.id + "\">" + book.gridName + "</a>";
                });

                navContents += "</div>";
            }

        });

        navContents += "<br /><br /></div>";

        document.getElementById(DIV_SCRIPTURES).innerHTML = navContents;

        */

        document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({
            id: DIV_SCRIPTURES_NAVIGATOR,
            content: volumesGridContent(volumeId)
        });

        document.getElementById(DIV_BREADCRUMBS).innerHTML = breadcrumbs(volumeForId(volumeId));
    };


    nextChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [bookId, chapter + 1, titleForBookChapter(book, chapter + 1)];
            }

            let nextBook = books[bookId + 1];

            if (nextBook !== undefined) {
                let nextChapterValue = 0;

                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }

                return [
                    nextBook.id,
                    nextChapterValue,
                    titleForBookChapter(nextBook, nextChapterValue)
                ];
            }
        }
    };

    onHashChanged = function () {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } else if (ids.length === 1) {
            let volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
                navigateHome();
            } else {
                navigateHome(volumeId);
            }
        } else if (ids.length >= 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(bookId);
                } else {
                    let chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(bookId, chapter);
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    };

    previousChapter = function (bookId, chapter) {
        // NEEDS WORK
    };

    setupMarkers = function () {
        if (window.google === undefined) {
            //retry after delay
            let retryId = window.setTimeout(setupMarkers, retryDelay);

            console.log(retryDelay);
            retryDelay += retryDelay;

            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }
        }

        if (gmMarkers.length > 0) {
            clearMarkers();
        }

        document.querySelectorAll("a[onclick^=\"showLocation(\"]").forEach(function (element) {
            let matches = LAT_LON_PARSER.exec(element.getAttribute("onclick"));

            if (matches) {
                let placename = matches[INDEX_PLACENAME];
                let latitude = parseFloat(matches[INDEX_LATITUDE]);
                let longitude = parseFloat(matches[INDEX_LONGITUDE]);
                let flag = matches[INDEX_PLACE_FLAG];

                if (flag !== "") {
                    placename += " " + flag;
                }

                addMarker(placename, latitude, longitude);
            }
        });
    };

    titleForBookChapter = function (book, chapter) {
        if (chapter > 0) {
            return book.tocName + " " + chapter;
        }

        return book.tocName;
    };

    volumeForId = function (volumeId) {
        if (volumeId !== undefined && volumeId > 0 && volumeId < volumes.length) {
            return volumes[volumeId - 1];
        }
    };

    volumesGridContent = function (volumeId) {
        let gridContent = "";

        volumes.forEach(function (volume) {
            if (volumeId === undefined || volumeId === volume.id) {
                gridContent += htmlDiv({
                    classKey: CLASS_VOLUME,
                    content: htmlAnchor(volume) + htmlElement(TAG_HEADER5, volume.fullName)
                });

                gridContent += booksGrid(volume);
            }
        });
        return gridContent + BOTTOM_PADDING;
    };


    /*
    * PUBLIC API
    */
    return {
        changeHash: changeHash,
        init: init,
        onHashChanged: onHashChanged
    };
})();