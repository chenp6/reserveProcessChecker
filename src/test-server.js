import cheerio from 'cheerio';
import FormData from 'form-data';
import fetch from 'node-fetch';
/*
const NYCURegisterInfo = {
    group: [1_3300] => {
        name: groupName,
        deptNo:groupNo.deptNo,
        link: queryLink,
        table: [],
        currentReserve: "",
        registered: 0,
        want: 0
    }
};
*/



const CCURegisterInfo = {
    group: new Map()
};


export async function init() {
    console.log("=== CCU loading ===")
    await setGroupMap();
    await updateGroupsInfo();
    const process = getReserveProcess("1_3300");
    console.log(process);
    const rank = getUserRank("1_3300", "333000017")
    console.log(rank)

    const rank2 = getUserRank("1_3300", "333000006")
    console.log(rank2)

    console.log("=== CCU done ===")

}

init()


async function setGroupMap() {
    const url = 'https://www026198.ccu.edu.tw/academic/query_reg/query_reg_3.php'
    const res = await fetch(url, {
        method: 'GET'
    })
    const resultHTML = await res.text();

    const $ = cheerio.load(resultHTML);
    $("table > tbody > tr > td > a").each((index, element) => {
        const groupName = $(element).text();
        const queryLink = $(element).attr("href");
        CCURegisterInfo.group.set(getGroupNo(queryLink), {
            name: groupName,
            link: queryLink,
            table: new Map(),
            currentReserve: "",
            registered: 0,
            want: 0
        })
        console.log(index)

    })

    function getGroupNo(queryLink) {
        const quries = queryLink.split('?')[1].split('&');
        const examNo = quries[2].split("=")[1];
        const deptNo = quries[1].split("=")[1];
        return examNo + "_" + deptNo;
    }
}

export async function updateGroupsInfo() {
    for (const [groupNo, groupInfo] of CCURegisterInfo.group) {
        /**
         * 榜單網頁
         */
        const deptNo = groupNo.split("_")[1];
        let rankUrl = `https://www.exam.ccu.edu.tw/ccuee_gp/Final/Name_${deptNo}.html` //第二階錄取科系
        let rankRes = await fetch(rankUrl, {
            method: 'GET'
        })

        if (rankRes.statusCode != 200) { //第一階錄取科系
            rankUrl = `https://www.exam.ccu.edu.tw/ccuee_gp/Final-1/Name_${deptNo}.html`
            rankRes = await fetch(rankUrl, {
                method: 'GET'
            })
        }
        const rankResultHTML = await rankRes.text();
        const $ = cheerio.load(rankResultHTML);


        const idList = [];
        $("table > tbody > tr > td").each((index, element) => {
            if (index % 2 == 0) {
                idList.push($(element).text().trim());
            }
        })


        /**
         * 報到狀況網頁
         */
        const processUrl = `https://www026198.ccu.edu.tw/academic/query_reg/${groupInfo.link}`
        const processRes = await fetch(processUrl, {
            method: 'GET'
        })
        const processResultHTML = await processRes.text();
        const $$ = cheerio.load(processResultHTML);
        const rankTable = new Map();
        let registered = 0;
        let want = 0;
        console.log(deptNo + " " + idList.length)
        $$("table > tbody > tr").each((index, element) => {
            if (index == 0) {
                return;
            }

            //td:eq(3)是抓取第四欄的文字 => 報到狀況
            const status = $$(element).find("td:eq(3)").text().trim();

            // //td:eq(1)是抓取第二欄的文字 => 准考證號
            // const id = $(element).find("td:eq(1)").text().trim();

            //td:eq(1)是抓取第二欄的文字 => 正備取
            const rankType = $$(element).find("td:eq(1)").text().trim();

            //td:eq(2)是抓取第三欄的文字 => (正備取)名次
            const rankNo = $$(element).find("td:eq(2)").text().trim();

            const rank = rankType + rankNo;

            if (status == "完成報到") {
                registered++;
            }

            if (rankType == "正取") {
                want++;
            }


            const reserveProcess = updateReserveProcess(rank, status);
            if (reserveProcess != null) {
                groupInfo.reserveProcess = reserveProcess;
            }

            const info = {
                index: index,
                rank: rank,
                status: status
            }
            rankTable.set(idList[index - 1], info); //index==0為標題列
        })
        groupInfo.table = rankTable;
        groupInfo.registered = registered;
        groupInfo.want = want;
    }


    function updateReserveProcess(rank, status) {
        if (rank.includes("正取")) { //正取
            return "等待正取報到/放棄中";
        } else if (status.includes("尚未遞補")) { //備取且還未備取到
            return null;
        } else { //備取且空白(待報到)，已報到，放棄...等
            return rank;
        }
    }

}





export function getUserRank(groupNo, userExamId) {
    const table = CCURegisterInfo.group.get(groupNo)?.table;
    if (table == undefined) {
        return null;
    } else {
        return table.get(userExamId);
    }
}

export function getReserveProcess(groupNo) {
    const info = CCURegisterInfo.group.get(groupNo);
    if (info == undefined) {
        return null;
    }

    return {
        registered: info.registered,
        want: info.want,
        reserveProcess: info.reserveProcess
    }
}