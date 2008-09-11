/*
	GMapToTCX 0.2
	http://code.google.com/p/gmap2tcx
	
	Extracts .tcx Courses compatible with the Garmin Training Center application from google maps.
	
	Based on the GMapToGPX 0.6a bookmarklet (http://www.elsewhere.org/journal/gmaptogpx/)
  
	Features:
		# extracts routes or points of interest from maps.google.com
		# the output is in .tcx format and can be imported to the Garmin Training Center application
			+ the individual points making up the route will be stored as Trackpoints
			+ for each driving direction a Coursepoint will be inserted
				- the description (Name) will be cut to 10 characters (and vowels removed) on a best 
				  guess approach
				- the symbol (PointType) will be guessed based on keywords (left, right, straight, ...)
			+ since Garmin Training Center expects a different Time value for each Trackpoint we 
			  simply increase the elapsed time by 10 seconds after each point
	
	Changelog:
		# v0.2:
			+ extracting keywords from driving directions for more accurate Coursepoint names
		# v0.1 (initial version): 
			+ creating TCX output with Coursepoints inserted for every driving direction
			
	TODO:
		# consider total distance (and possibly estimated time) in order to have more accurate 
		  timestamps for points
	
	Author:  
		tknerr

*/

var error = 0;
var version = '0.2';
var googledoc = ""; // will hold retrieved google info
var gpxvar = ""; // will hold gHomeVPage structure, even for IE
var routes = new Array();
var polylines = new Array();
var milestones = new Array();
var googlepage; // Will hold the page element that gets toggled. May change.
var charset;


function fixup (foo) {
	foo = foo.replace(/\\x3e/g, '>');
	foo = foo.replace(/\\x3c/g, '<');
	foo = foo.replace(/\\x26/g, '&');
	foo = foo.replace(/\\x42/g, '"');
	foo = foo.replace(/\\x3d/g, '=');
	foo = foo.replace(/\\u003e/g, '>');
	foo = foo.replace(/\\u003c/g, '<');
	foo = foo.replace(/\\u0026/g, '&');
	foo = foo.replace(/\\042/g, '"');
	foo = foo.replace(/"*polylines"*:\s*/g, 'polylines:');
	foo = foo.replace(/"*markers"*:\s*/g, 'markers:');
	foo = foo.replace(/"*id"*:\s*/g, 'id:');
	foo = foo.replace(/"*lat"*:\s*/g, 'lat:');
	foo = foo.replace(/"*lng"*:\s*/g, 'lng:');
	foo = foo.replace(/"*laddr"*:\s*/g, 'laddr:');
	foo = foo.replace(/"*points"*:\s*/g, 'points:');
	foo = foo.replace(/\\"/g, '"');
	foo = foo.replace(/\"/g, '\'');
	return foo;
}

function callInProgress (xmlhttp) {
	switch (xmlhttp.readyState) {
		case 1: case 2: case 3:
			return true;
			break;
		// Case 4 and 0
		default:
			return false;
			break;
	}
}

// Synchronous, with an alarm to catch timeouts (30 seconds)
// No idea if this is the best way to do this, but for sure the best way I
// came up with at 3 in the morning.
function loadXMLDoc(url) {
	var req;
	var timeoutid;
	if (window.XMLHttpRequest) {
		req = new XMLHttpRequest();
		showstatusdiv('Loading...');
		timeoutid = window.setTimeout( function(){if(callInProgress(req)){req.abort();}}, 30000);
		req.open("GET", url, false);
		req.send(null);
		window.clearTimeout(timeoutid);
		hidestatusdiv();
	} else if (window.ActiveXObject) {
		req = new ActiveXObject("Microsoft.XMLHTTP");
		if (req) {
			showstatusdiv('Loading...');
			timeoutid = window.setTimeout( function(){if(callInProgress(req)){req.abort();}}, 30000);
			req.open("GET", url, false);
			req.send();
			window.clearTimeout(timeoutid);
			hidestatusdiv();
		}
	}
	if (req.readyState == 4) {
		// only if "OK"
		if (req.status == 200) {
			return(req.responseText);
		} else {
			showstatusdiv('Error ' + req.status + ' getting google data: ' + req.statusText);
			return('');
		}
	} else {
		showstatusdiv('Error: loadXMLDoc continued with readystate: ' + req.readyState);
		return('');
	}
}


// This function is from Google's polyline utility.
function decodeLine (encoded) {
	var len = encoded.length;
	var index = 0;
	var array = [];
	var lat = 0;
	var lng = 0;

	while (index < len) {
		var b;
		var shift = 0;
		var result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lat += dlat;
		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lng += dlng;
		array.push({"lat": round(lat * 1e-5), "lon": round(lng * 1e-5)});
	}
	return array;
}



function gmaptogpxdiv(dtype) { 
	var mypoints = null;
	
	// 1= gmaps POIs
	// 2= gmaps route
	var qtype = 0;
  
	// gmaps route 
	if (gpxvar && gpxvar.overlays && gpxvar.overlays.polylines) {
		qtype = 2;
		
		// Load "polylines" up with the decoded polyline segments
		for (i = 0; i < gpxvar.overlays.polylines.length; i++) {
			polylines[i] = decodeLine(gpxvar.overlays.polylines[i].points);
		}
		
		// Stuff the descriptions into the "polylines" array
		if (segmatch = googledoc.match(/<td class=.?dirsegtext.*?id=.?dirsegtext.*?<\/tr>/g)) {
			for (var s = 0; s < segmatch.length; s++) {
				var route = segmatch[s].replace(/.*dirsegtext_([0-9]+)_([0-9]+).*/, "$1");
				var step = segmatch[s].replace(/.*dirsegtext_([0-9]+)_([0-9]+).*/, "$2");
				var keywords = segmatch[s].match(/<b\b[^>]*>.*?<\/b>/g);
				var desc = segmatch[s].replace(/.*dirsegtext[^>]+>(.*?)<\/td>.*/, "$1");				
				var polyline = gpxvar.drive.routes[route].steps[step].polyline;
				var ppt = gpxvar.drive.routes[route].steps[step].ppt;
				polylines[polyline][ppt].desc = deamp(desc);
				polylines[polyline][ppt].keywords = keywords.map(function(s){return deamp(s)});
			}
		}
    
		// Figure out which polylines go into which routes
		for (i = 0; i < gpxvar.drive.routes.length; i++) {
			var start = gpxvar.drive.routes[i].steps[0].polyline;
			var end = gpxvar.drive.routes[i].steps[gpxvar.drive.routes[i].steps.length - 1].polyline;
			var route = "route" + i;
			routes[route] = new Array();
			for (n = start; n <= end; n++) {
				routes[route] = routes[route].concat(polylines[n]);
			}
		}
			
		// Get the milestone descriptions
		var msaddrmatch;
		if (msaddrmatch = gpxvar.panel.match(/<div id=.?sxaddr.?>.*?<\/div>/g)) {
			for (var i = 0; i < msaddrmatch.length; i++) {
				milestones[parseInt(i)] = deamp(msaddrmatch[i].replace(/<div id=.?sxaddr.?><div[^>]+>(.*?)<\/div>/, "$1"));
			}
		}
		
	// gmaps POis
  } else  if (googledoc.match(/id:'(A|addr)'/)) {
		qtype = 1;
		routes['poi'] = new Array();
		
		var markers=googledoc.slice(googledoc.indexOf('markers:['));
		/*	markers=markers.slice(0, markers.indexOf('polylines: [')); */
		
		var pois = markers.match(/{id:'([A-Z]|addr|loc\d+)'.*?\}/g);
		for (var i = 0; i < pois.length; i++) {	
			var lat = pois[i].replace(/.*lat:(.*?),.*/, "$1");
		  var lon = pois[i].replace(/.*lng:(.*?),.*/, "$1");
		  var desc = pois[i].replace(/.*laddr:'(.*?)',.*/, "$1");
	  	desc = desc.replace(/ @.*/, "");
		  desc = desc.replace(/(.*) \((.*)\)/, "$2 ($1)");
		  routes['poi'].push({"lat": round(lat), "lon": round(lon), "desc": deamp(desc)});
		}
  }
    
  if (qtype==0) {
		errorbox('<p>There doesn\'t seem to be any extractable data on this page.</p><p>If there is, but it\'s not detected, please visit the <a href="http://code.google.com/p/gmap2tcx/">GMapToTCX site</a> or the original <a href="http://www.elsewhere.org/GMapToGPX/">GMapToGPX project homepage</a> and leave a bug report, including a link to the page you\'re on right now.</p><p><strong>Note:</strong> Google Maps mashups (that is, a page with a Google Map on it, but not at google.com) do not automatically work with this utility. If you would like to see GMapToGPX work with your Google Maps mashup site, please leave a comment on the project page.</p>');
		closebox();
		return(0); 
  }

	/* t contains the text that will be injected into a <div> overlay */
	var t="<div style='border:3px dotted #DCDCDC;padding:2px;background-color:#FFFFFF;margin-left:auto;margin-right:auto;'>";
	t+="<div style='background-color:#DCDCDC;'>";
	t+='<ul class="menubar">';
	t+='<li class="menubar">GMapToTCX v' + version + '</li>';
	t+='<li class="menubar"><a href="javascript:closebox();">close [x]</a></li></ul></div>';
	t+='<textarea rows="20" cols="120">';
	
	var coursepoints = new Array();
	
	//get the start tags for the TCX file
	t+= getTcxCourseStart('gmaps course');	
	t+= getTcxTrackStart();
	
	startDate = new Date();
	now = new Date();
	
	//gmaps route
	if (qtype==2) {
		timeDiff = 0;
		for (var key in routes) {
			var route = routes[key];
			//buf.append("      <trkseg>\n");
			for(i=0;i<route.length;i++) {
				if (i == route.length - 1) {
					route[i].desc = milestones[1 + parseInt(key.replace(/route/,''))];
				} else if ((route[i].lat == route[i+1].lat) && (route[i].lon == route[i+1].lon)) {
					continue;
				}
				
				//TODO: increment time
				//time = '2008-09-09T06:00:00Z';
				timeDiff += 10000;
				time = getXsdDate(new Date(now.getTime() + timeDiff));
				
				//append a TCX Trackpoint tag for each point
				t+= getTcxTrackpoint(route[i].lat, route[i].lon, time);
				
				//store coursepoints for later on
				if (route[i].desc) {
					coursepoints.push({"lat": route[i].lat, "lon": route[i].lon, "desc": route[i].desc, "time": time, "keywords": route[i].keywords ? route[i].keywords : new Array()});
				}
			}
//			buf.append("      </trkseg>\n");
		}
	
	//gmaps POIs
  } else if (qtype == 1) {
		timeDiff = 0;
		/* This is a page with points of interest - spit out waypoints. */
		for(i=0;i<routes['poi'].length;i++){
	    var point = routes['poi'][i];
			
			//TODO: increment time
			//time = '2008-09-09T06:00:00Z';
			timeDiff += 10000;
			time = getXsdDate(new Date(now.getTime() + timeDiff));
			
			//append a TCX Trackpoint tag for each point
			t+= getTcxTrackpoint(point.lat, point.lon, time);
			
			//store coursepoints for later on
			coursepoints.push({"lat": point.lat, "lon": point.lon, "desc": point.desc, "time": time, "keywords": new Array()});
	    //		'      <cmt>' + point.desc.replace(/(.*) \((.*)\)/, "$2 ($1)") + '</cmt>\n' +
		}
		
	} else {
		errorbox('An unknown error occurred. Please leave a bug report at the <a href="http://www.elsewhere.org/GMapToGPX/">project homepage</a> and include a link to the page you\'re on right now.');
		error = 1;
  }
  
	//end the TCX track, add coursepoints, and close the Course
	t+= getTcxTrackEnd();
	for (i=0;i<coursepoints.length;i++) {
		cp = coursepoints[i];
		t+= getTcxCoursepoint(cp.lat, cp.lon, cp.time, cp.desc, cp.keywords);
	}
	t+= getTcxCourseEnd();
	
	t+='</textarea>';
	t+="<div style='background-color:#DCDCDC;'>";
	t+='<ul class="menubar">';
	t+='<li class="menubar"><a href="javascript:closebox();">close [x]</a></li></ul></div></div>';
	displaybox(t);
}


function getTcxCourseStart(coursename) {
	return '' +
			'<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
			'<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"\n' +
			'		xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
			'		xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n' +
			'	<Courses>\n' +
			'		<Course>\n' +
			'			<Name>' + getTcxName(coursename, 15) + '</Name>\n';
}

function getTcxTrackStart(){
	return '' +
			'			<Track>\n';
}

function getTcxTrackpoint(lat, lon, time) {
	return '' +
			'				<Trackpoint>\n' +
			'					<Time>' + time + '</Time>\n' +
			'					<Position>\n' +
			'						<LatitudeDegrees>' + lat + '</LatitudeDegrees>\n' +
			'						<LongitudeDegrees>' + lon + '</LongitudeDegrees>\n' +
			'					</Position>\n' +
			'				</Trackpoint>\n';
}

function getTcxTrackEnd() {
	return '' +
			'			</Track>\n'; 
}

function getTcxCoursepoint(lat, lon, time, desc, keywords) {
	return '' + 
			'			<CoursePoint>\n' +
      '				<Name>' + getTcxCoursepointName(desc, keywords) + '</Name>\n' +
      '				<Time>' + time + '</Time>\n' +
			'				<Position>\n' + 
			'					<LatitudeDegrees>' + lat + '</LatitudeDegrees>\n' +
			'					<LongitudeDegrees>' + lon + '</LongitudeDegrees>\n' +
			'				</Position>\n' +
			'				<PointType>' + getTcxCoursepointType(desc) + '</PointType>\n' +
			'			</CoursePoint>\n';
}

function getTcxCourseEnd() {
	return '' +  
			'		</Course>\n' + 
			'	</Courses>\n' +
			'</TrainingCenterDatabase>\n';
}


function getTcxName(string, maxlen) {
	//trim, replace whitespaces with _, remove special chars and cut to maxlen
	string = ('' + string).replace(/^\s+|\s+$/g, '').replace(/\s/g,'_').replace(/[^A-Za-z_0-9]/g,'').substr(0,maxlen);
	if (string.length<1) {
		string = 'n_a';
	}
	return string;
}

function getTcxCoursepointName(desc, keywords) {
	var way_desc = "";
	//use keywords for getting the most important bits
	if (keywords && keywords.length > 0) {
		//filter out keywords used in getTcxCoursepointType
		keywords = keywords.filter(function(s){
			return !s.match(/left|links|right|rechts|straight|continue|geradeaus/i);
		});
		way_desc = keywords.join('_');
	} else {
		way_desc = desc;
	}
	//replace str and remove all vowels to fit the most information into 10 chars
	way_desc = (''+way_desc).replace(/street|stra.?e|strasse/ig, 'str').replace(/[aeiou]/g,'');
	if (way_desc.length > 10) {	
		way_desc = way_desc.substr(way_desc.length - 10);
	}
	return getTcxName(way_desc, 10);
}

function getTcxCoursepointType(desc) {
	//try to guess the type
	if (desc.match(/left|links/i)) {
		return 'Left';
	} else if (desc.match(/right|rechts/i)) {
		return 'Right';
	} else if (desc.match(/straight|continue|geradeaus/i)) {
		return 'Straight';
	} else {
		return 'Generic';
	}
}

function getXsdDate(d) {
	//2008-09-09T06:00:58Z
	year = d.getFullYear();
	month = (d.getMonth()+1) > 9 ? (d.getMonth()+1) : '0' + (d.getMonth()+1);
	day = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
	h = d.getHours() > 9 ? d.getHours() : '0' + d.getHours();
	m = d.getMinutes() > 9 ? d.getMinutes() : '0' + d.getMinutes();
	s = d.getSeconds() > 9 ? d.getSeconds() : '0' + d.getSeconds();
	return year + '-' + month + '-' + day + 'T' +	h + ':' + m + ':' + s + 'Z';
}


// Clean up floating point math errors
function round(a) {
	return parseInt(a*1E+5)/1E+5;
}


function deamp(a) {
	a = a.replace(/<br *\/>(.+)/g, ", $1");
	a = a.replace(/<br *\/>/g, '');
	a = a.replace(/&#39;/g, '\'');
	a = a.replace(/\\047/g, '\'');
	a = a.replace(/\\042/g, '\"');
	a = a.replace(/&#160;/g, ' ');
	a = a.replace(/<\/*b>/g, '');
	a = a.replace(/<wbr\/*>/g, '');
	a = a.replace(/<div[^>]*?>.*?<\/div>/g, ' ');
	a = a.replace(/\\\'/g, '\''); 
	a = a.replace(/\\\"/g, '\"');
	a = a.replace(/\\x26/g, '&');
	a = a.replace(/&/g, '&amp;');  
	a = a.replace(/&amp;amp;amp;/g, '&amp;amp;');
	a = a.replace(/\\n/g, '');
	a = a.replace(/\\t/g, '');
	a = a.replace(/\s+/g, ' ');
	a = a.replace(/^\s+/, '');
	a = a.replace(/\s+$/, '');
	return a;
}

function displaybox(boxcontents) {
	closebox();
	if (googlepage=document.getElementById("page")) {
		googlepage.style.display='none';
	}
	var z=document.body.appendChild(document.createElement("div"));
	z.id = "gpxbox";
	// I don't know about this stuff; it came from badsegue.
	z.style.position = "absolute";	
	if (self.pageYOffset != null) {	
		z.style.top = self.pageYOffset + "px";	
	} else if (document.documentElement.scrollTop != null) {
		z.style.top = document.documentElement.scrollTop + "px";	
	}
	z.style.width = "99%";
	z.style.zIndex = "1000";
	z.innerHTML = boxcontents;
}
	
function closebox() { 
	var gpxbox;
	if (gpxbox = document.getElementById("gpxbox")) {
		document.body.removeChild(gpxbox);
	}
	if (googlepage != undefined) {
		googlepage.style.display='block';
	}
}

function errorbox(a) {
	var err = '<a href="http://code.google.com/p/gmap2tcx/">GMapToTCX</a> v' + version + " (ERROR)<br />" + a;
	showstatusdiv(err);
}

function showstatusdiv(boxcontents) {
	hidestatusdiv();
	z=document.body.appendChild(document.createElement("div"));
	z.id = "statusbox";
	z.style.position = "absolute";	
	if (self.pageYOffset != null) {	
		z.style.top = self.pageYOffset + "px";	
	} else if (document.documentElement.scrollTop != null) {
		z.style.top = document.documentElement.scrollTop + "px";	
	}
	z.style.width = "50%";
	z.style.left = "0px";
	z.style.background = "#ffffff";
	z.style.border = ".3em solid #ff0000";
	z.style.padding = ".3em 1.3em .3em .3em";
	z.style.zIndex = "1000";
	z.innerHTML = '<div style="position: absolute; border: 1px solid black; top: 0px; right: 0px;"><span style="padding: .3em; font-weight: bold;"><a style="text-decoration: none;" title="Close status box" href="#" onclick="javascript:hidestatusdiv();">X</a></span></div>';
	z.innerHTML += boxcontents;
}

function hidestatusdiv() { 
	var statusbox;
	if (statusbox = document.getElementById("statusbox")) {
		document.body.removeChild(statusbox);
	}
}	

// main()
if (document.location.hostname.indexOf('google') >= 0) {
	for (var i = 0; i < document.links.length; i++) {
		if (document.links.item(i).innerHTML && (document.links.item(i).style.display != 'none') && (document.links.item(i).innerHTML.indexOf('view_as_kml') >= 0)) {
			var kmlurl = document.links.item(i).href; 
			if (kmlurl.indexOf(':void') < 0) {
				kmlurl = kmlurl.replace(/output=nl/, 'output=kml');
				errorbox('This is a "My Maps" page, which means that the original KML used to create it is available. Please <a href="' + kmlurl + '">download the KML file</a> (using this link, not the one provided by Google) and convert it using <a href="http://www.gpsvisualizer.com/convert" target="_new">GPSVisualizer</a>.');
				error = 1;
				break;
			}
		}

		// bar_icon_link is the "link to this page" icon. If they change 
		// its name, I need to fix that here.
		if (document.links.item(i).innerHTML && (document.links.item(i).innerHTML.indexOf('bar_icon_link') >= 0)) {
			var googleurl = document.links.item(i).href;
			googleurl = googleurl.replace(/&view=text/, '');
			googledoc = loadXMLDoc(googleurl);
			charset=googledoc.slice(googledoc.indexOf('charset='));
			charset=charset.slice(8, charset.indexOf('"'));
			// Doing this as a regexp was causing firefox to stall out. bah.
			var encpointblob=googledoc.slice(googledoc.indexOf('var gHomeVPage'));
			encpointblob=encpointblob.slice(0, encpointblob.indexOf('};//') + 2);
			encpointblob=encpointblob.replace(/gHomeVPage/, "gpxvar");
			eval(encpointblob);
			googledoc=fixup(googledoc);
			continue;
		}
	}
}

charset = charset ? charset : "UTF-8";

if (error != 1) {
	// Default action. If it's not a route, the argument doesn't matter.
	gmaptogpxdiv("allpoints");
} else {
	closebox();
}

