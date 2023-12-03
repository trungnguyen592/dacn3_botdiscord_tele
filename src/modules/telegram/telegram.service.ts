import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

import { BotService } from '../bot/bot.service';

const logger = new Logger('TelegramBot');

@Injectable()
export class TelegramService {
  private telegramBot: TelegramBot;
  private telegramBotId: string;
  private telegramBotMessage: string;

  constructor(
    private configService: ConfigService,
    private readonly botService: BotService,
  ) {
    this._setup();
  }
  async _setup() {
    const botToken = this.configService.get('telegram.telegramBotToken', {
      infer: true,
    }) as string;
    this.telegramBotId = botToken.split(':')[0];

    this.telegramBotMessage = this.configService.get(
      'telegram.telegramBotMessage',
      {
        infer: true,
      },
    ) as string;

    // Method 1: Use Polling
    this.telegramBot = new TelegramBot(botToken, { polling: true });
    this.telegramBot.on('polling_error', (error) => {
      logger.error('Polling Error', error);
    });

    this.telegramBot.on('new_chat_members', async (msg) => {
      this.handleEvent(() => this.handleNewMemberJoined(msg));
    });

    this.telegramBot.on('left_chat_member', async (msg) => {
      this.handleEvent(() => this.handleUpdateGroup(msg));
    });

    this.telegramBot.on('message', async (msg) => {
      this.handleEvent(async () => this.handleAsk(msg));
    });

    this.telegramBot.onText(/\/start/, (msg) => {
      this.handleEvent(() => this.handleStartCommand(msg));
    });
  }

  handleEvent = (_cb: () => void) => {
    try {
      _cb();
    } catch (error) {
      logger.error(error);
    }
  };

  handleNewMemberJoined = ({ chat, new_chat_members }: TelegramBot.Message) => {
    const chatId = chat.id;
    const newMember = new_chat_members[0];
    if (String(newMember.id) === this.telegramBotId) {
      const message = this.telegramBotMessage;
      this.telegramBot.sendMessage(chatId, message);
    } else {
      const fullName = `${newMember.first_name} ${newMember.last_name}`;
      const username = newMember.username;
      const message =
        username === undefined
          ? `Welcome ${fullName} to the group!`
          : `Welcome @${username} to the group!`;
      this.telegramBot.sendMessage(chatId, message);
    }
  };

  handleUpdateGroup = ({ chat, left_chat_member }: TelegramBot.Message) => {
    const chatId = chat.id;
    const leftMember = left_chat_member[0];
    const message = `${leftMember.first_name} has left the group.`;
    this.telegramBot.sendMessage(chatId, message);
  };

  handleAsk = async ({ chat, text }: TelegramBot.Message) => {
    const chatId = chat.id;
    const userQuestion = text;

    const answer = await this.botService.ask(userQuestion);
    this.telegramBot.sendMessage(chatId, answer, { parse_mode: 'Markdown' });
  };

  handleStartCommand = ({ chat }: TelegramBot.Message) => {
    const chatId = chat.id;
    const message = this.telegramBotMessage;
    this.telegramBot.sendMessage(chatId, message);
  };
}