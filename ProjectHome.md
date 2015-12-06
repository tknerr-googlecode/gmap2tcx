## GMapToTCX Bookmarklet ##

Extracts .tcx Courses compatible with the Garmin Training Center application from google maps.

Based on the GMapToGPX 0.6a bookmarklet (http://www.elsewhere.org/journal/gmaptogpx/)

### Features ###
  * extracts routes or points of interest from maps.google.com
  * the output is in .tcx format and can be imported to the Garmin Training Center application
    * the individual points making up the route will be stored as Trackpoints
    * for each driving direction a Coursepoint will be inserted
      * the description (Name) will be cut to 10 characters (and vowels removed) on a best guess approach
      * the symbol (PointType) will be guessed based on keywords (left, right, straight, ...)
    * since Garmin Training Center expects a different Time value for each Trackpoint we simply increase the elapsed time by 10 seconds after each point

### Installation ###

Create a new bookmark, name it GMapsToTCX and paste the following into the location field:

**`javascript:(function(){var script=document.createElement('script');script.src='http://gmap2tcx.googlecode.com/svn/trunk/gmap2tcx/src/gmap2tcx.js';document.getElementsByTagName('head')[0].appendChild(script);})()`**

(_hint: you can also simply drag the 'GMapsToTCX bookmarklet' in the Links sections on the right to your browser's bookmarks toolbar!_)

### Changelog ###
  * **v0.2**:
    * extracting keywords from driving directions for more accurate Coursepoint names
  * **v0.1 (initial version)**:
    * creating TCX output with Coursepoints inserted for every driving direction

### TODO ###
  * consider total distance (and possibly estimated time) in order to have more accurate timestamps for points
  * in case of gmaps POIs, don't create a course but only POIs (if that's possible within Garmin Training Center)

### Instructions ###

_**1) start with getting driving directions (or search for businesses) on Google Maps**_

http://gmap2tcx.googlecode.com/files/gmaps.PNG

_**2) then click the GMapToTCX bookmarklet**_

http://gmap2tcx.googlecode.com/files/bookmarklet2.PNG

_**3) copy the xml output, save it to file.tcx and import it to Garmin Training Center (File -> Import -> Courses...)**_

http://gmap2tcx.googlecode.com/files/trainingcenter.PNG

_**4) finally, send the course to your [Forerunner 405](http://www.amazon.com/gp/redirect.html?ie=UTF8&location=http%3A%2F%2Fwww.amazon.com%2FGARMIN-Forerunner-405-Enabled-Sports%2Fdp%2FB0011UNMIK&tag=eboosear-20&linkCode=ur2&camp=1789&creative=9325) device and use it for navigation**_

![http://www.navigadget.com/wp-content/postimages/2008/03/forerunner-405-4.jpg](http://www.navigadget.com/wp-content/postimages/2008/03/forerunner-405-4.jpg)