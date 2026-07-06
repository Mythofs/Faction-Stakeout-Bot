const { SlashCommandBuilder } = require("discord.js");
const stakeoutStore = require("../../stakeoutStore.js");

module.exports = {
    data: new SlashCommandBuilder().setName("list").setDescription("Lists all factions being staked out"),
    async execute(interaction) {
        try {
            if(stakeoutStore.size == 0)
                return await interaction.reply("Not staking out any factions");
            let s = "";
            for(const facId of stakeoutStore.keys())
                s += facId + ", ";
            await interaction.reply(`Staking out: ${s.substring(0,s.length-2)}`);
        }
        catch(e) { return await interaction.reply(`Error occurred when listing factions ${e}`); }
    }
}