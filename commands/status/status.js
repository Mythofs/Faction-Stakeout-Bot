const { SlashCommandBuilder } = require("discord.js");
const statusStore = require("../../statusStore");

module.exports = {
    data: new SlashCommandBuilder().setName("status").setDescription("Lists all members matching in a specified state")
        .addStringOption(option => option.setName("status").setDescription("The status").setRequired(true)
        .addChoices({name: "Okay", value: "Okay"},
            {name: "Hospital", value: "Hospital"},
            {name: "Traveling", value: "Traveling"},
            {name: "Abroad", value: "Abroad"},
            {name: "Overseas Hospital", value: "Overseas Hospital"})),
    async execute(interaction) {
        const status = interaction.options.getString("status");
        const channel = interaction.client.channels.cache.get(process.env.STATUS_CHANNEL_ID);
        const reply = [""];
        let index = 0;
        for(const [id, data] of statusStore) {
            let s = "";
            if(status == "Overseas Hospital")
                if(data.memberStatus.status.state == "Hospital" && members.status.description.includes(" a"))
                    s = `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${id}) [${data.memberData.name}](https://torn.com/profiles.php?XID=${id}) (${data.stat.bs_estimate_human}) - ${data.memberData.status.description}`;
            else if(data.memberStatus.status.state == status)
                s = `\n[Attack](https://www.torn.com/page.php?sid=attack&user2ID=${id}) [${data.memberData.name}](https://torn.com/profiles.php?XID=${id}) (${data.stat.bs_estimate_human}) - ${data.memberData.status.description}`;
            if((reply[index] + s).length < 2000)
                reply[index] += s;
            else {
                index++;
                reply[index] = s;
            }
        }
        for(const str of reply)
            channel.send(reply);
    }
}