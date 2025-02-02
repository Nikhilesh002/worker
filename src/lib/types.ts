import { Id } from "../../convex/_generated/dataModel";

export type IMessageRole = "user" | "assistant";

export interface IMessage {
  role: IMessageRole;
  content: string;
}

export interface IChatRequestBody {
  messages: IMessage[];
  newMessage: string;
  chatId: Id<"chats">;
}

export enum IStreamMessageType {
  Token = "token",
  Error = "error",
  Connected = "connected",
  Done = "done",
  ToolStart = "tool_start",
  ToolEnd = "tool_end",
}

export interface IBaseStreamMessage {
  type: IStreamMessageType;
}

export interface ITokenMessage extends IBaseStreamMessage {
  type: IStreamMessageType.Token;
  token: string;
}

export interface IErrorMessage extends IBaseStreamMessage {
  type: IStreamMessageType.Error;
  error: string;
}

export interface IConnectedMessage extends IBaseStreamMessage {
  type: IStreamMessageType.Connected;
}

export interface IDoneMessage extends IBaseStreamMessage {
  type: IStreamMessageType.Done;
}

export interface IToolStartMessage extends IBaseStreamMessage {
  type: IStreamMessageType.ToolStart;
  tool: string;
  input: unknown;
}

export interface IToolEndMessage extends IBaseStreamMessage {
  type: IStreamMessageType.ToolEnd;
  tool: string;
  output: unknown;
}

export type IStreamMessage =
  | ITokenMessage
  | IErrorMessage
  | IConnectedMessage
  | IDoneMessage
  | IToolStartMessage
  | IToolEndMessage;
