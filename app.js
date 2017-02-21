/*
Adam Quinton
MIT License
*/
const tinyreq = require('tinyreq');
const cheerio = require('cheerio');
const tableParser = require('cheerio-tableparser');
const Browser = require('zombie');
const fs = require('fs');
const getQueryParam = require('get-query-param');
const csvWriter = require('csv-write-stream');

const HOME_PAGE = 'http://www.presidency.ucsb.edu';

// to not act like a DOS attack :)
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function getPageBody (url, needsJavaScript = false) {
  console.log('REQUESTING', url);
  return new Promise(function(resolve, reject) {
    if (needsJavaScript) { // use zombie for needsJS sites
      const browser = new Browser();
      browser.visit(url).then(function() {
        let body = browser.document.documentElement.innerHTML;
        browser.tabs.closeAll()
        resolve(Buffer.from(body, 'utf8'));
      }).catch(err => reject(err));
    } else {
      tinyreq({ url: url,
                headers: {
                    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.59 Safari/537.36"
                }}, (err, bodaciousBody) => {
        if (err) {
          // reject(err);
          //TODO: fix back
          resolve('')
        }
        resolve(bodaciousBody);
      });
    }
  });
}

function cleanse(data) {
  return data.filter(d => d.length > 0)
}

function getCandidateHtml(candidate) {
  return new Promise(function(resolve, reject) {
    let outfile = candidate.name.replace(' ', '_')+'.csv';

    let speechesWriter = csvWriter();
    speechesWriter.pipe(fs.createWriteStream(outfile));

    candidate.links.forEach((link, j) => {
      // if (link.type == 'campaign speeches')
      getPageBody(link.url).then((html, err) => {
        if (err) reject(err);
        let ch = cheerio.load(html);
        let speechLinks = ch('table[align=center] a');
        for (let x=0; x<speechLinks.length;x++) {
          let speechUrl = HOME_PAGE+'/'+speechLinks[x].attribs.href.substr(3);
          // let randMilis = getRandomInt(10, 100);
          // setTimeout(function waitABit(){
            getPageBody(speechUrl)
            .then((html2, err) => {
              if (err) reject(err);
              let ch2 = cheerio.load(html2);
              let speechText = ch2('.displaytext');
              let docDate = ch2('.docdate').html();
              let papersTitle = ch2('.paperstitle').html();
                speechesWriter.write({ candidateId: candidate.id, candidateName: candidate.name, speechUrl: link.url, speechType: link.type, docDate: docDate, papersTitle: papersTitle, speechText, speechText });
                if (x === speechLinks.length-1 && j === candidate.links.length-1) {
                  resolve(`success, wrote to ${outfile}!`);
                  speechesWriter.end();
                }
            // }, randMilis)
          });
        }
      });
    });
  });
}

function scrape(url, needsJavaScript = false)  {
  getPageBody(url, needsJavaScript).then((html, err) => {
    let $ = cheerio.load(html);
    tableParser($);
    data1 = $("table[align=center]").parsetable()[1];//list of candidates
    data2 = cleanse(data1)
    data2 = data2.filter((d, i) => i >= 2);

    candidates = data2.map((item) => {
      ch = cheerio.load(item);

      let campaignLinks = ch('p > a')
      console.log('*** links');
      let id = '';
      let links = [];
      for (let i = 0; i < campaignLinks.length; i++) {
        let a = campaignLinks[i];
        let link = HOME_PAGE+'/'+a.attribs.href;
        id = getQueryParam('candidate', link);
        let docType = a.children[0].data;
        console.log(link, docType, id);
        links.push({type: docType, url: link});
      };

      let basicInfo = ch('p > span.roman');
      let name = '';
      if (basicInfo.length > 0) {
        name = basicInfo[0].children[0].data.trim();
      }

      return {id: id,
              name: name,
              links: links
            };
    });

    candidates.forEach((can, i) => {
      //TODO: remove next line to loop through each candidates speeches
      if (i === 0)
      getCandidateHtml(can).then(canHtml => {
        //write a file for each candidate
        console.log(`THIS WAS RESOLVED ${can.name}`);
      }).catch(err => {
        console.log(`ERROR getting data for ${can.name}: ${err}`);
      });

    });

    // fs.writeFile('stuff.json', JSON.stringify(candidates, null, 2), function (err) {
    //   if (err) return console.log(err);
    //   console.log('wrote it');
    // });
  });
}

scrape(HOME_PAGE+'/2016_election.php');
// scrape(HOME_PAGE+'/2008_election.php');
