# Architecture Overview

## System Architecture

```mermaid
flowchart TB
    User[Telegram User] -->|sends message| TG[Telegram API]
    TG -->|webhook/polling| Bot[Bot Application]
    Bot -->|parse command| Parser[Message Parser]
    Parser -->|valid expense| Sheets[Sheets Service]
    Parser -->|invalid| Error[Error Handler]
    Sheets -->|append row| GS[Google Sheets API]
    GS -->|update| Sheet[Google Sheet]
    Sheets -->|success| Bot
    Bot -->|confirmation| TG
    TG -->|displays| User
    Error -->|error message| Bot
```

## Component Architecture

```mermaid
flowchart LR
    subgraph Application
        BotTS[bot.ts<br/>Main Entry Point]
        ParserTS[parser.ts<br/>Message Parser]
        SheetsTS[sheets.ts<br/>Sheets Service]
        TypesTS[types.ts<br/>Type Definitions]
    end
    
    subgraph External
        Telegram[Telegram Bot API]
        Google[Google Sheets API]
    end
    
    BotTS -->|uses| ParserTS
    BotTS -->|uses| SheetsTS
    ParserTS -->|uses| TypesTS
    SheetsTS -->|uses| TypesTS
    BotTS -->|connects to| Telegram
    SheetsTS -->|connects to| Google
```

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant T as Telegram
    participant B as Bot
    participant P as Parser
    participant S as Sheets Service
    participant G as Google Sheets

    U->>T: /expense 50 groceries
    T->>B: Message event
    B->>P: Parse message text
    P->>P: Validate amount & format
    alt Valid expense
        P->>B: Expense object
        B->>S: Log expense
        S->>G: Append row
        G->>S: Success
        S->>B: Logged successfully
        B->>T: Confirmation message
        T->>U: ✅ Expense logged: $50.00
    else Invalid format
        P->>B: Error message
        B->>T: Error message
        T->>U: ❌ Invalid format
    end
```

## Module Responsibilities

### bot.ts
- **Purpose:** Main application entry point
- **Responsibilities:**
  - Initialize Telegram bot
  - Load configuration
  - Handle bot commands
  - Coordinate between parser and sheets service
  - Send responses to users

### parser.ts
- **Purpose:** Parse and validate expense messages
- **Responsibilities:**
  - Extract amount and description from text
  - Validate numeric amounts
  - Format dates
  - Return structured expense objects

### sheets.ts
- **Purpose:** Google Sheets integration
- **Responsibilities:**
  - Authenticate with Google API
  - Initialize sheet with headers
  - Append expense rows
  - Query expense data
  - Calculate totals

### types.ts
- **Purpose:** TypeScript type definitions
- **Responsibilities:**
  - Define Expense interface
  - Define BotConfig interface
  - Define ParseResult interface

### verify-setup.ts
- **Purpose:** Setup verification utility
- **Responsibilities:**
  - Check environment variables
  - Verify credentials file exists
  - Validate configuration
  - Provide helpful error messages

## Configuration Flow

```mermaid
flowchart TD
    ENV[.env file] -->|load| Dotenv[dotenv package]
    CREDS[credentials.json] -->|read| FS[File System]
    Dotenv -->|process.env| Config[Bot Configuration]
    FS -->|JSON parse| Config
    Config -->|initialize| Bot[Bot Instance]
    Config -->|initialize| Sheets[Sheets Service]
```

## Error Handling Strategy

```mermaid
flowchart TD
    Error[Error Occurs]
    Error -->|Parse Error| ParseHandler[Return ParseResult with error]
    Error -->|Sheets API Error| SheetsHandler[Log & throw error]
    Error -->|Bot Error| BotHandler[Send error message to user]
    
    ParseHandler --> UserMessage[User-friendly message]
    SheetsHandler --> Console[Console error log]
    BotHandler --> UserMessage
    
    UserMessage --> Telegram[Send to Telegram]
```

## Deployment Flow

```mermaid
flowchart LR
    Code[Source Code] -->|npm install| Deps[Install Dependencies]
    Deps -->|tsc| Build[Compile TypeScript]
    Build -->|node| Run[Run Application]
    Run -->|polling| Active[Active Bot]
    Active -->|SIGINT/SIGTERM| Shutdown[Graceful Shutdown]
```

## Authentication Flow

### Telegram
```mermaid
flowchart LR
    Token[Bot Token] -->|API Key| TelegramAPI[Telegram API]
    TelegramAPI -->|authenticate| BotSession[Bot Session]
    BotSession -->|polling| Messages[Receive Messages]
```

### Google Sheets
```mermaid
flowchart LR
    JSON[credentials.json] -->|load| ServiceAccount[Service Account]
    ServiceAccount -->|JWT Auth| GoogleAPI[Google Sheets API]
    GoogleAPI -->|access| Sheet[Spreadsheet]
```

## Key Design Decisions

### 1. **Polling vs Webhooks**
- **Choice:** Polling
- **Reason:** Simpler setup, no need for public URL or SSL certificates
- **Trade-off:** Slightly higher latency but easier for local development

### 2. **Service Account vs OAuth**
- **Choice:** Service Account
- **Reason:** No user interaction needed, bot runs autonomously
- **Trade-off:** Requires sharing sheet with service account email

### 3. **TypeScript vs JavaScript**
- **Choice:** TypeScript
- **Reason:** Type safety, better IDE support, fewer runtime errors
- **Trade-off:** Build step required

### 4. **Structured Commands vs Natural Language**
- **Choice:** Structured commands (`/expense <amount> <description>`)
- **Reason:** Simpler parsing, more reliable, easier to validate
- **Trade-off:** Less flexible than natural language

## Scalability Considerations

### Current Implementation
- ✅ Single bot instance
- ✅ Suitable for personal/small team use
- ✅ Simple deployment

### Future Enhancements (if needed)
- Multiple sheet support per user/group
- Database for faster queries
- Webhook deployment for better performance
- Category tagging and filtering
- Budget tracking and alerts
- Monthly/weekly summaries
- Currency conversion
- Receipt image support

## Security Architecture

```mermaid
flowchart TD
    Secrets[Sensitive Data]
    Secrets -->|stored in| EnvFile[.env file]
    Secrets -->|stored in| CredsFile[credentials.json]
    
    EnvFile -->|excluded by| GitIgnore[.gitignore]
    CredsFile -->|excluded by| GitIgnore
    
    GitIgnore -->|prevents| Commit[Git Commits]
    
    EnvFile -->|runtime only| Process[process.env]
    CredsFile -->|runtime only| FileRead[fs.readFileSync]
```

## Performance Characteristics

- **Message Processing:** < 100ms (parse + validate)
- **Sheet Append:** ~500-1000ms (Google API call)
- **Total Response Time:** ~1-2 seconds
- **Memory Footprint:** ~50-100MB
- **CPU Usage:** Minimal (event-driven)

---

This architecture provides a solid foundation for a reliable, maintainable expense tracking bot.
