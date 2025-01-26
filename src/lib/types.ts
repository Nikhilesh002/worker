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
  type: StreamMessageType;
}

export interface ITokenMessage extends IBaseStreamMessage {
  type: StreamMessageType.Token;
  token: string;
}

export interface IErrorMessage extends IBaseStreamMessage {
  type: StreamMessageType.Error;
  error: string;
}

export interface IConnectedMessage extends IBaseStreamMessage {
  type: StreamMessageType.Connected;
}

export interface IDoneMessage extends IBaseStreamMessage {
  type: StreamMessageType.Done;
}

export interface IToolStartMessage extends IBaseStreamMessage {
  type: StreamMessageType.ToolStart;
  tool: string;
  input: unknown;
}

export interface IToolEndMessage extends IBaseStreamMessage {
  type: StreamMessageType.ToolEnd;
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
