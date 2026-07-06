const { SlashCommandBuilder } = require("discord.js");
const stakeoutStore = require("../../stakeoutStore");
const statusStore = require("../../statusStore");
const safeFetch = require("../../safeFetch");

module.exports = { 
    data: new SlashCommandBuilder().setName("stakeout").setDescription("Starts staking out a faction")
        .addStringOption((option) => option.setName("facid").setDescription("The faction to stakeout").setRequired(true)), 
    async execute(interaction) {
        try {
            const facId = interaction.options.getString("facid", true);
            if(stakeoutStore.has(facId))
                return await interaction.reply(`Already staking out ${facId}`);
            await interaction.reply(`Started staking out ${facId}`);
            const channel = interaction.client.channels.cache.get(process.env.CHANNEL_ID);
            const reply = await checkStatus(process.env.API_KEY, facId, channel);
            let message;
            if(reply.length >= 4000)
                message = await channel.send("Message too long, exceeds 4000 characters");
            else
                message = await channel.send(reply);
            const intervalId = setInterval(async() => {
                const reply = await checkStatus(process.env.API_KEY, facId, channel);
                if(reply.length >= 4000)
                    await message.edit("Message too long, exceeds 4000 characters");
                else
                    await message.edit(reply);
            }, 30000);
            stakeoutStore.set(facId, {"interval": intervalId, "message": message.id});
        }
        catch(e) {
            console.log(e);
            channel.send(`Error while staking out ${e}`);
        }
    },
};
async function checkStatus(apiKey, facId, channel)
{
    try {
        const memberData = await safeFetch(`https://api.torn.com/v2/faction/${facId}/members?striptags=true&timestamp=${Date.now()/1000}&comment=Faction%20Stakeout&key=${apiKey}`, channel);
        let reply = "Available Targets:";
        const ids = [];
        const targets = [];
        for(const member of memberData.members) {
            if(member.status.state == "Okay" || member.status.state == "Hospital" && !member.status.description.includes(" a ") && member.status.until - Date.now() / 1000 < 300)
                targets.push(member.id);
            if(member.status.state == "Traveling" && statusStore.has(member.id)) {
                const status = statusStore.get(member.id).status;
                if(status.until != null && status.until - Date.now() / 1000 < 300)
                    targets.push(member);
                else if(status.state == "Abroad")
                    member.status.until = getTime(member.status.description, member.status.plane_image_type);
            }
            statusStore.set(member.id, member);
        }
        if(targets.length > 0) {
            const sorted = targets.sort((a, b) => statusStore.get(a).status.until - statusStore.get(b).status.until);
            const stats = await safeFetch(`https://ffscouter.com/api/v1/get-stats?key=${process.env.FFSCOUTER_KEY}&targets=${sorted.join()}`, channel);
            for(const stat of stats) {
                const member = statusStore.get(stat.player_id);
                if(member.status.state == "Okay")
                    reply += `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${stat.player_id}) [${member.name}](https://torn.com/profiles.php?XID=${stat.player_id}) (${stat.bs_estimate_human}) out`;
                else
                    reply += `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${stat.player_id}) [${member.name}](https://torn.com/profiles.php?XID=${stat.player_id}) (${stat.bs_estimate_human}) out <t:${member.status.until}:R>`;
            }
        }
        return reply;
    }
    catch(e) {
        console.log(e);
        channel.send("Error while checking status" + e);
    }
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