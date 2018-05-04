/*
Adam Quinton
MIT License
*/
const path = require('path');
const tinyreq = require('tinyreq');
const cheerio = require('cheerio');
const tableParser = require('cheerio-tableparser');
const fs = require('fs');
const getQueryParam = require('get-query-param');
const htmlToText = require('html-to-text');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const HOME_PAGE = 'http://www.presidency.ucsb.edu';
const CANDIDATE_NUMBER = Number(process.argv[3]) || false;
const ELECTION_YEAR = process.argv[2] || '2016';
const RAND_MS_MIN = 50;
const RAND_MS_MAX = 750;

// to not act like a DOS attack :)
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function getPageBody (url, needsJavaScript = false) {
  console.log('REQUESTING', url);
  return new Promise(function(resolve, reject) {
    if (needsJavaScript) {
      throw new Error('no javascript browser set up');
    } else {
      tinyreq({ url: url,
                headers: {
                    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.59 Safari/537.36"
                }}, (err, bodaciousBody) => {
        if (err) {
          console.log(`ERROR requesting speech from URL: ${url}\n${err}`);
          resolve('');
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

    const adapter = new FileSync(`${candidate.name.replace(' ', '_')}_${ELECTION_YEAR}_speeches.json`)
    const db = low(adapter)
    db.defaults({ speeches: []})
      .write()

    candidate.links.forEach((link, j) => {
      getPageBody(link.url).then((html, err) => {
        if (err) reject(err);
        let ch = cheerio.load(html);
        let speechLinks = ch('table[align=center] a');
        for (let x = 0; x < speechLinks.length; x++) {
          let speechUrl = HOME_PAGE+'/'+speechLinks[x].attribs.href.substr(3);
          let randMilis = getRandomInt(RAND_MS_MIN, RAND_MS_MAX);
          setTimeout(function waitABit(){
            getPageBody(speechUrl)
            .then((html2, err) => {
              if (err) reject(err);
              let ch2 = cheerio.load(html2);
              let speechText = htmlToText.fromString(ch2('.displaytext'), { wordwrap: false });
              let docDate = ch2('.docdate').html();
              let papersTitle = ch2('.paperstitle').html();
              db.get('speeches')
                .push({ candidateId: candidate.id, candidateName: candidate.name, speechUrl: link.url, speechType: link.type, docDate: docDate, papersTitle: papersTitle, speechText, speechText })
                .write();
              if (x === speechLinks.length-1 && j === candidate.links.length-1) {
                resolve(x);
              }
            }, randMilis);
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
      let id = '';
      let links = [];
      for (let i = 0; i < campaignLinks.length; i++) {
        let a = campaignLinks[i];
        let link = HOME_PAGE+'/'+a.attribs.href;
        id = getQueryParam('candidate', link);
        let docType = a.children[0].data;
        links.push({type: docType, url: link});
      };

      let basicInfo = ch('p > span.roman');
      let name = '';
      if (basicInfo.length > 0) {
        name = basicInfo[0].children[0].data.trim();
      }

      return {id: id,
              name: name,
              links: links };
    });

    candidates.forEach((can, i) => {
      if (!CANDIDATE_NUMBER) {
        if (i === 0) {
          console.log(`Usage: ${path.basename(process.argv[0])} ${path.basename(process.argv[1])} year id`);
          console.log(`\nid name`);
        }
        let iterate = i+1 < 10 ? ` ${i+1}`: `${i+1}`;
        console.log(`${iterate} ${can.name}`);
      }
      if (i+1 === CANDIDATE_NUMBER)
      getCandidateHtml(can).then(numSpeeches => {
        //report for each candidate
        console.log(`Completed write for ${can.name}, wrote ${numSpeeches} speeches`);
      }).catch(err => {
        console.log(`ERROR getting data for ${can.name}: ${err}`);
      });
    });
  });
}

scrape(`${HOME_PAGE}/${ELECTION_YEAR}_election.php`);
