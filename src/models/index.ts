import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: 'mysql',
  logging: false,
});

// ---- User ----

interface UserAttributes {
  id: number;
  email: string;
  username: string;
  passwordHash: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'passwordHash' | 'createdAt' | 'updatedAt'> {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: number;
  declare email: string;
  declare username: string;
  declare passwordHash: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email:        { type: DataTypes.STRING(191), allowNull: false, unique: true },
    username:     { type: DataTypes.STRING(20),  allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, tableName: 'User', timestamps: true },
);

// ---- TestResult ----

interface TestResultAttributes {
  id: number;
  userId: number | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  charsCorrect: number;
  charsWrong: number;
  duration: number;
  charErrors: object;
  wpmTimeline: object;
  createdAt?: Date;
}

interface TestResultCreationAttributes
  extends Optional<TestResultAttributes, 'id' | 'createdAt'> {}

export class TestResult
  extends Model<TestResultAttributes, TestResultCreationAttributes>
  implements TestResultAttributes
{
  declare id: number;
  declare userId: number | null;
  declare wpm: number;
  declare rawWpm: number;
  declare accuracy: number;
  declare consistency: number;
  declare charsCorrect: number;
  declare charsWrong: number;
  declare duration: number;
  declare charErrors: object;
  declare wpmTimeline: object;
  declare readonly createdAt: Date;
}

TestResult.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId:       { type: DataTypes.INTEGER, allowNull: true },
    wpm:          { type: DataTypes.FLOAT,   allowNull: false },
    rawWpm:       { type: DataTypes.FLOAT,   allowNull: false },
    accuracy:     { type: DataTypes.FLOAT,   allowNull: false },
    consistency:  { type: DataTypes.FLOAT,   allowNull: false },
    charsCorrect: { type: DataTypes.INTEGER, allowNull: false },
    charsWrong:   { type: DataTypes.INTEGER, allowNull: false },
    duration:     { type: DataTypes.INTEGER, allowNull: false },
    charErrors:   { type: DataTypes.JSON,    allowNull: false },
    wpmTimeline:  { type: DataTypes.JSON,    allowNull: false },
  },
  { sequelize, tableName: 'TestResult', timestamps: true, updatedAt: false },
);

// ---- Associations ----

User.hasMany(TestResult, { foreignKey: 'userId', onDelete: 'SET NULL' });
TestResult.belongsTo(User, { foreignKey: 'userId' });
