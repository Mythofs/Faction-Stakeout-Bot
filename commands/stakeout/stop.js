const { SlashCommandBuilder } = require("discord.js");
const stakeoutStore = require("../../stakeoutStore");

module.exports = { 
    data: new SlashCommandBuilder().setName("stop").setDescription("Stops staking out a faction")
        .addStringOption((option) => option.setName("facid").setDescription("The faction to stop staking out").setRequired(true)), 
    async execute(interaction) {
        try {
            const facId = interaction.options.getString("facid", true);
            if(!stakeoutStore.has(facId))
                return interaction.reply(`Not staking out ${facId}`);
            const info = stakeoutStore.get(facId);
            clearInterval(info.interval);
            const channel = interaction.client.channels.cache.get(process.env.CHANNEL_ID);
            const message = await channel.messages.fetch(info.message);
            await message.delete();
            stakeoutStore.delete(facId);
            return interaction.reply(`Stopped staking out ${facId}`);
        }
        catch(e) {
            console.log(e);
        }
    },
};