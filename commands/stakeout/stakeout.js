const { SlashCommandBuilder } = require("discord.js");
const stakeoutStore = require("../../stakeoutStore");
const statusStore = require("../../statusStore");
const safeFetch = require("../../safeFetch");

module.exports = { 
    data: new SlashCommandBuilder().setName("stakeout").setDescription("Starts staking out a faction")
        .addStringOption((option) => option.setName("facid").setDescription("The faction to stakeout").setRequired(false)), 
    async execute(interaction) {
        try {
            const facId = interaction.options.getString("facid", true);
            if(!facId) {
                if(stakeoutStore.size == 0)
                    return await interaction.reply("Not staking out any factions");
                let s = "";
                for(const info of stakeoutStore.values())
                    s += `${info.info.basic.name} (${info.info.basic.id}), `;
                await interaction.reply(`Staking out: ${s.substring(0,s.length-2)}`);
            }
            const channel = interaction.client.channels.cache.get(process.env.CHANNEL_ID);
            if(stakeoutStore.has(facId)) {
                deleteStakeout(facId);
                return await interaction.reply(`Stopped staking out ${info.info.basic.name}`);
            }
            if(stakeoutStore.size > 0)
                deleteStakeout(facId);
            const facInfo = await safeFetch(`https://api.torn.com/v2/faction/${facId}/basic?comment=Faction%20Stakeout&key=${process.env.API_KEY}`, channel);
            if(!facInfo) return;
            await interaction.reply(`Started staking out ${facInfo.basic.name} (${facId})`);
            const messages = [];
            const reply = await checkStatus(process.env.API_KEY, facId, facInfo.basic.name, channel);
            for(const i in reply)
                messages[i] = await channel.send(reply[i]);
            stakeoutStore.set(facId, {"message": messages.map(message => message.id), "info": facInfo});
            const intervalId = setInterval(async() => {
                try {
                    const reply = await checkStatus(process.env.API_KEY, facId, facInfo.basic.name, channel);
                    for(const i in reply)
                        if(messages[i] == null)
                            messages[i] = await channel.send(reply[i]);
                        else
                            messages[i] = await messages[i].edit(reply[i]);
                    for(const i = reply.length; i < messages.length; i++) {
                        await messages[i].delete();
                        mesasges[i] = null;
                    }
                    stakeoutStore.get(facId).message = messages.map(message => message.id);
                }
                catch(e) {
                    console.log(e);
                    channel.send(`Error while staking out ${e}`);
                }
            }, 30000);
            stakeoutStore.get(facId).interval = intervalId;
        }
        catch(e) {
            console.log(e);
            channel.send(`Error while staking out ${e}`);
        }
    },
};
async function checkStatus(apiKey, facId, facName, channel)
{
    try {
        const memberData = await safeFetch(`https://www.tornstats.com/api/v2/${process.env.TORNSTATS_KEY}/spy/faction/${facId}`, channel);
        if(!memberData) return;
        const reply = [`${facName} (${facId}) Available Targets:`];
        let index = 0;
        const missingStats = [];
        const targets = [];
        const formatter = new Intl.NumberFormat("en-US", {notation: "compact"});
        for(const member of memberData.members) {
            if(member.status.state == "Okay" || member.status.state == "Hospital" && !member.status.description.includes(" a ") && member.status.until - Date.now() / 1000 < 300)
                targets.push(member.id);
            if(member.status.state == "Traveling" && statusStore.has(member.id)) {
                const status = statusStore.get(member.id).status;
                if(status.until != null && status.state == "Traveling") {
                    member.status.until = status.until;
                    if(status.until - Date.now() / 1000 < 300)
                        targets.push(member.id);
                }
                else if(status.state == "Abroad")
                    member.status.until = getTime(member.status.description, member.status.plane_image_type);
            }
            statusStore.set(member.id, { "memberData": member});
            if("spy" in member && Math.floor(Date.now() / 1000) - member.spy.timestamp < 604800)
                statusStore.get(member.id).stats = formatter.format(member.spy.total);
            else
                missingStats.push(member.id);
        }
        if(missingStats.length > 0) {
            const stats = await safeFetch(`https://ffscouter.com/api/v1/get-stats?key=${process.env.FFSCOUTER_KEY}&targets=${missingStats.join()}`, channel);
            if(!stats) return;
            for(const stat of stats)
                statusStore.get(stat.player_id).stats = stat.bs_estimate_human;
        }
        if(targets.length > 0) {
            const sorted = targets.sort((a, b) => statusStore.get(a).status.until - statusStore.get(b).status.until);
            for(const target of sorted) {
                const member = statusStore.get(target);
                let s = "";
                if(member.status.state == "Okay" || member.status.state == "Abroad")
                    s += `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${target}) [${member.name}](https://torn.com/profiles.php?XID=${target}) (${member.stats}) out`;
                else
                    s += `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${target}) [${member.name}](https://torn.com/profiles.php?XID=${target}) (${member.stats}) out <t:${member.status.until}:R>`;
                if(member.status.color == "blue") {
                    const match = member.status.description.match(/^(?:traveling from torn to (.+)|traveling from (.+) to torn|in (.+))$/i);
                    const country = (match[1] || match[2] || match[3]).trim();
                    s += ` in ${country}`;
                }
                //" a" should cover  for both a/an
                if(member.status.state == "Hospital" && member.status.description.includes(" a")) {
                    const country = getCountry(member.status.description);
                    s += `in ${country}`;
                }
                if((reply[index] + s).length > 2000) {
                    index++;
                    reply[index] = "";
                }
                reply[index] += s;
            }
        }
        return reply;
    }
    catch(e) {
        console.log(e);
        channel.send("Error while checking status" + e);
        return "";
    }
}
function deleteStakeout(facId)
{
    const info = stakeoutStore.get(facId);
    clearInterval(info.interval);
    for(const id of info.message) {
        const message = await channel.messages.fetch(id);
        await message.delete();
    }
    stakeoutStore.clear();
    statusStore.clear();
}
function getTime(description, planeType)
{
    let multiplier = 0.9474;
    if(planeType == "light_aircraft") multiplier *= 0.7;
    else if(planeType == "airliner") multiplier *= 0.3;
    let time = 0;
    if(description.includes("Mexico")) time = 26;
    if(description.includes("Cayman")) time = 35;
    if(description.includes("Canada")) time = 41;
    if(description.includes("Hawaii")) time = 134;
    if(description.includes("United Kingdom")) time = 26;
    if(description.includes("Argentina")) time = 167;
    if(description.includes("Switzerland")) time = 175;
    if(description.includes("Japan")) time = 225;
    if(description.includes("China")) time = 242;
    if(description.includes("United Arab Emirates")) time = 271;
    if(description.includes("South Africa")) time = 297;
    return time * 60 * multiplier + Date.now() / 1000 - 60;
}
function getCountry(description)
{
    const country = description.match(/^in (?:an?\s+)?(.+?)\s+hospital(?:\s+for\s+.+)?$/i)[1].trim();
    switch(country) {
        case "Mexican": return "Mexico";
        case "Caymanian": return "Cayman Islands";
        case "Canadian": return "Canada";
        case "Hawaiian": return "Hwaii";
        case "British": return "UK";
        case "Argentinian": return "Argentina";
        case "Swiss": return "Switzerland";
        case "Japanese": return "Japan";
        case "Chinese": return "China";
        case "Emirati": return "UAE";
        case "South African": return "South Africa";
    }
    return "Unknown Country";
}