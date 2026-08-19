export type RoomStatus = "waiting" | "voting" | "revealed";

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          room_code: string;
          current_question: string;
          status: RoomStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          current_question?: string;
          status?: RoomStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          current_question?: string;
          status?: RoomStatus;
          created_at?: string;
        };
      };
      votes: {
        Row: {
          id: string;
          room_id: string;
          session_id: string;
          choice: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          session_id: string;
          choice: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          session_id?: string;
          choice?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Vote = Database["public"]["Tables"]["votes"]["Row"];

export interface VoteCounts {
  yes: number;
  no: number;
  total: number;
}
