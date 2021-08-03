const { Client } = require('discord.js');
const ytdl = require('ytdl-core');
const search = require('youtube-search');
const { token, apikey } = require('./token.json');
const { prefix } = require('./config.json');
const client = new Client();

const opts = {
	maxResults: 5,
	key: apikey
};

// 建立一個類別來管理 Property 及 Method
class Music {

    constructor() {
        /**
         * 下面的物件都是以 Discord guild id 當 key，例如：
         * this.isPlaying = {
         *     724145832802385970: false
         * }
         */

        /**
         * 機器人是否正在播放音樂
         * this.isPlaying = {
         *     724145832802385970: false
         * }
         */
        this.isPlaying = {};

        /**
         * 等待播放的音樂隊列，例如：
         * this.queue = {
         *     724145832802385970: [{
         *         name: 'G.E.M.鄧紫棋【好想好想你 Missing You】Official Music Video',
         *         url: 'https://www.youtube.com/watch?v=P6QXo88IG2c&ab_channel=GEM%E9%84%A7%E7%B4%AB%E6%A3%8B'
         *     }]
         * }
         */
        this.queue = {};

        // https://discord.js.org/#/docs/main/stable/class/VoiceConnection
        this.connection = {};

        // https://discord.js.org/#/docs/main/stable/class/StreamDispatcher
        this.dispatcher = {};
		
		this.currentVolume = 0.5;
    }

    async join(msg) {

        // 如果使用者正在頻道中
        if (msg.member.voice.channel !== null) {
            // Bot 加入語音頻道
            this.connection[msg.guild.id] = await msg.member.voice.channel.join();
			await msg.channel.send('機器人加入語音頻道');
        } else {
            await msg.channel.send('請先進入語音頻道');
        }

    }

    async play(msg, args) {

        // 語音群的 ID
        const guildID = msg.guild.id;

        // 如果 Bot 還沒加入該語音群的語音頻道
        if (!this.connection[guildID]) {
            await msg.channel.send(`請先將機器人 ${prefix}join 加入頻道`);
            return;
        }

        // 如果 Bot leave 後又未加入語音頻道
        else if (this.connection[guildID].status === 4) {
            await msg.channel.send(`請先將機器人 ${prefix}join 重新加入頻道`);
            return;
        }
		
        // 處理字串，將 !!play 字串拿掉，只留下 YouTube 網址
		var musicURL = '';
		
		if(args.length === 0) return;
		
		if(args.indexOf('http') === -1){
			search(args, opts, async (err, results) => {
				if(err) return console.log(err);
				console.log(results);
				musicURL = results[0].link;
				let title = results[0].title;
				await msg.channel.send('搜尋結果：'+title);
				try {
					// 取得 YouTube 影片資訊
					const res = await ytdl.getInfo(musicURL);
					const info = res.videoDetails;

					// 將歌曲資訊加入隊列
					if (!this.queue[guildID]) {
						this.queue[guildID] = [];
					}

					this.queue[guildID].push({
						name: info.title,
						url: musicURL
					});

					// 如果目前正在播放歌曲就加入隊列，反之則播放歌曲
					if (this.isPlaying[guildID]) {
						await msg.channel.send(`歌曲加入隊列：${info.title}`);
					} else {
						this.isPlaying[guildID] = true;
						this.playMusic(msg, guildID, this.queue[guildID][0]);
					}

				} catch(e) {
					console.log(e);
				}
			});
			
		}
		
		else {
			musicURL = args.trim();
			try {
				// 取得 YouTube 影片資訊
				const res = await ytdl.getInfo(musicURL);
				const info = res.videoDetails;

				// 將歌曲資訊加入隊列
				if (!this.queue[guildID]) {
					this.queue[guildID] = [];
				}

				this.queue[guildID].push({
					name: info.title,
					url: musicURL
				});

				// 如果目前正在播放歌曲就加入隊列，反之則播放歌曲
				if (this.isPlaying[guildID]) {
					await msg.channel.send(`歌曲加入隊列：${info.title}`);
				} else {
					this.isPlaying[guildID] = true;
					this.playMusic(msg, guildID, this.queue[guildID][0]);
				}

			} catch(e) {
				console.log(e);
			}
		}
    }
	
	search(msg, keyword){
		search(keyword, opts, function(err, results) {
			if(err) return console.log(err);
			console.log(results);
			msg.channel.send('搜尋結果：'+results[0].title);
		});
	}

    playMusic(msg, guildID, musicInfo) {

        // 提示播放音樂
        msg.channel.send(`播放音樂：${musicInfo.name}`);

        // 播放音樂
        this.dispatcher[guildID] = this.connection[guildID].play(ytdl(musicInfo.url, { filter: 'audioonly' }));

        // 把音量降 50%，不然第一次容易被機器人的音量嚇到 QQ
        this.dispatcher[guildID].setVolume(this.currentVolume);

        // 移除 queue 中目前播放的歌曲
        this.queue[guildID].shift();

        // 歌曲播放結束時的事件
        this.dispatcher[guildID].on('finish', () => {

            // 如果隊列中有歌曲
            if (this.queue[guildID].length > 0) {
                this.playMusic(msg, guildID, this.queue[guildID][0]);
            } else {
                this.isPlaying[guildID] = false;
                msg.channel.send('目前沒有音樂了，請加入音樂 :D');
            }

        });

    }

    resume(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('恢復播放');

            // 恢復播放
            this.dispatcher[msg.guild.id].resume();
        }

    }

    pause(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('暫停播放');

            // 暫停播放
            this.dispatcher[msg.guild.id].pause();
        }

    }

    skip(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('跳過目前歌曲');

            // 跳過歌曲
            this.dispatcher[msg.guild.id].end();
        }

    }

    nowQueue(msg) {

        // 如果隊列中有歌曲就顯示
        if (this.queue[msg.guild.id] && this.queue[msg.guild.id].length > 0) {
            // 字串處理，將 Object 組成字串
            const queueString = this.queue[msg.guild.id].map((item, index) => `[${index+1}] ${item.name}`).join();
            msg.channel.send(queueString);
        } else {
            msg.channel.send('目前隊列中沒有歌曲');
        }

    }

    leave(msg) {

        // 如果機器人在頻道中
        if (this.connection[msg.guild.id] && this.connection[msg.guild.id].status === 0) {

            // 如果機器人有播放過歌曲
            if (this.queue.hasOwnProperty(msg.guild.id)) {

                // 清空播放列表
                delete this.queue[msg.guild.id];

                // 改變 isPlaying 狀態為 false
                this.isPlaying[msg.guild.id] = false;
            }

            // 離開頻道
            this.connection[msg.guild.id].disconnect();
			msg.channel.send('機器人離開語音頻道');
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }

    }
}

const music = new Music();

// 當 Bot 接收到訊息時的事件
client.on('message', async (msg) => {
	const args = msg.content.slice(prefix.length).split(' ');
	const cmd = args.shift().toLowerCase();
    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    // !!join
    if (cmd === 'join') {

        // 機器人加入語音頻道
        music.join(msg);
    }

    // 如果使用者輸入的內容中包含 !!play
    else if (cmd === 'play' && args.length != 0) {

        // 如果使用者在語音頻道中
        if (msg.member.voice.channel) {
			let keyword = '';
			for(let i=0; i<args.length; i++){
				keyword += args[i]+' ';
			}
			keyword = keyword.trim();
			// 播放音樂
            await music.play(msg, keyword);
        } else {

            // 如果使用者不在任何一個語音頻道
            msg.reply('你必須先加入語音頻道');
        }
    }

    // !!resume
    else if (cmd === 'resume') {

        // 恢復音樂
        music.resume(msg);
    }

    // !!pause
    else if (cmd === 'pause') {

        // 暫停音樂
        music.pause(msg);
    }

    // !!skip
    else if (cmd === 'skip') {

        // 跳過音樂
        music.skip(msg);
    }

    // !!queue
    else if (cmd === 'queue') {

        // 查看隊列
        music.nowQueue(msg);
    }

    // !!leave
    else if (cmd === 'leave') {

        // 機器人離開頻道
        music.leave(msg);
    }
	else if(cmd === 'search' && args.length != 0){
		let keyword = '';
		for(let i=0; i<args.length; i++){
			keyword += args[i]+' ';
		}
		keyword = keyword.trim();
		music.search(msg, keyword);
	}
});

// 連上線時的事件
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(token);
