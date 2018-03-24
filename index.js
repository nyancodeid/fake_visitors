const request = require('request')
const Promise = require('bluebird')
const async = require('async')
const json = require('jsonfile')
const _ = require('underscore')
let moment = require("moment")
let squel = require("squel")

const _request = Promise.promisify(request)
const _jsonRead = Promise.promisify(json.readFile)

let total = 0

let getMember = new Promise((resolve, reject) => {
    _jsonRead('./member.json').then((members) => {
        resolve(members[0].data)
    }).catch(reject)
})


let optionsVisitor = (id, inst, isDosen) => {
    let headers = {
        'Origin': 'http://digilib.stikesicme-jbg.ac.id',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Referer': 'http://digilib.stikesicme-jbg.ac.id/akasia/index.php?p=visitor',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive',
    };

    let dataString = `memberID=${id}&institution=${(isDosen) ? "DOSEN" : inst}&counter=true`;
    return {
        url: 'http://digilib.stikesicme-jbg.ac.id/akasia/index.php?p=visitor',
        method: 'POST',
        headers: headers,
        body: dataString
    };
}
let pushVisitor = (id, inst, isDosen) => {
    return new Promise((resolve, reject) => {
        _request(optionsVisitor(id, inst, isDosen)).then((body) => {
            if (body.statusCode == 200) {
               resolve("DONE#" + id)
            } else {
                reject(body.statusCode)
            }
        })
    })
}


function getFakeVisitor(push, options) {
    const memberFake = _.random(...options.count)
    const memberType = _.sample(["2", "4"])

    return getMember.then((members) => {
        let sample = members.filter((item) => {
            if (_.isNull(item.inst_name) || _.isNull(item.inst_name) || item.inst_name == "") {
                return false
            } else {
                if (item.member_type_id == memberType) {
                    return true
                } else {
                    return false
                }
            }
        }).map((item) => {
            return {
                id: item.member_id,
                name: item.member_name.toUpperCase(),
                inst: item.inst_name.toUpperCase().replace(' ', '+'),
                type: item.member_type_id
            }
        })

        sample = _.sample(sample, memberFake)

        if (push) {
            async.each(sample, (candidate, callback) => {
                pushVisitor(candidate.id, candidate.inst, (memberType == "4") ? true : false).then((status) => {
                    callback(null)
                }).catch(callback)
            }, (err) => {
                if (err) {
                    console.error(err)
                } else {
                    console.log(`DONE!! ${memberFake}`)
                }
            })
        } else {
            return sample
        }
    })
}

async function manipulateVisitor() {
    let fakes = await getFakeVisitor(false, {
        count: [10, 20]
    })
    let data = []

    function randomDate(start, end) {

        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    }
    function writeDown() {
        let date = randomDate(new Date(2017, 0, 1), new Date())

        return moment(date).hours(_.random(7, 16)).minutes(_.random(1, 59)).seconds(_.random(1, 59)).format("YYYY-MM-DD HH:mm:ss")
    }
    function makeSQL(sample) {
        let date = writeDown()

        return squel.insert()
            .into("visitor_count")
            .set("member_id", sample.id)
            .set("member_name", sample.name)
            .set("institution", sample.inst)
            .set("checkin_date", date)
            .toString()
    }

    fakes.forEach((sample) => {
        data.push(makeSQL(sample))
    })

    let query = new Buffer(JSON.stringify(data)).toString('base64')

    _request({
        url: "http://digilib.stikesicme-jbg.ac.id/akasia/inject.php",
        method: "POST",
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `query=${query}`
    }).then((body) => {
        if (body.statusCode == 200 && (body.body == '{"success":true}')) {
            console.log(`T:[${total}] DONE #${fakes.length}`)

            total += fakes.length * 1
        } else {
            console.error(body.body)
        }
    })
}

setInterval(() => {
    if (total >= 3000) {
        console.error('STOP')
    } else {
        manipulateVisitor()
    }
}, 1000 * 30)