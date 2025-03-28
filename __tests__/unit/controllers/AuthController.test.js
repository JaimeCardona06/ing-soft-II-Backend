jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Creamos mocks para las funciones de Prisma
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();

// Mock de PrismaClient
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
      users: {
          findUnique: mockFindUnique,
          create: mockCreate,
      },
  })),
}));

// Mock de bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("test_token")
}));


const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { signUp, signIn } = require("../../../src/controllers/AuthController");

// Mock que omite algunos de los console.log del AuthController
jest.spyOn(console, "log").mockImplementation(() => { });

describe("SignUp Controller Method", () => {
  let req;
  let res;

  // Reiniciar mocks antes de cada prueba
  beforeEach(() => {
      jest.clearAllMocks();
      req = {
          body: {},
      };
      res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
      };
  });

  test("Return message all required fields", async () => {
      // Pasamos el request body de la solicitud
      req.body = {
          fullname: "User Test",
          // email y current_password no se enviaron
      };
      // Ejecutamos la prueba
      await signUp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
          message: "All required fields: fullname, email and password",
      });
  });

  test("Should return error for invalid email format", async () => {
      req.body = {
          fullname: "User Test",
          email: "test.com",
          current_password: "test123",
      };
      await signUp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid email format" });
  });

  test("Should return error for length password", async () => {
      req.body = {
          fullname: "User Test",
          email: "test@test.com",
          current_password: "test1",
      };
      await signUp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
          message: "Password must be at least 6 characters long",
      });
  });

  test("Should return error if email allready exists", async () => {
      req.body = {
          fullname: "User Test",
          email: "test1@test.com",
          current_password: "test123",
      };

      // Configuramos el comportamiento del mock
      mockFindUnique.mockResolvedValue({
          id: 1,
          email: "test1@test.com",
      });

      await signUp(req, res);

      expect(mockFindUnique).toHaveBeenCalledWith({
          where: { email: "test1@test.com" },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
          message: "Email already registered",
      });
  });

  test("Should create a user successfull", async () => {
      req.body = {
          fullname: "User Test",
          email: "test@test.com",
          current_password: "test123",
      };

      // Usuario no existe
      mockFindUnique.mockResolvedValue(null);

      // Configurar mock para el hash
      const hashedPassword = "hashed_password";
      bcrypt.hash.mockResolvedValue(hashedPassword);

      // Configurar mock para la creación de usuario
      const createdUser = {
          id: 1,
          fullname: "User Test",
          email: "test@test.com",
      };
      mockCreate.mockResolvedValue(createdUser);

      await signUp(req, res);

      expect(mockFindUnique).toHaveBeenCalledWith({
          where: { email: "test@test.com" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("test123", 10);
      expect(mockCreate).toHaveBeenCalledWith({
          data: {
              fullname: "User Test",
              email: "test@test.com",
              current_password: hashedPassword,
          },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
          message: "User created successfully",
          user: createdUser,
      });
  });
});

describe("SignIn Controller Method", () => {
  let req;
  let res;

  beforeEach(() => {
      jest.clearAllMocks();
      req = {
          body: {},
      };
      res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
      };
  });

  test("Should return error when email and password are not provided", async () => {
      req.body = {};

      await signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
          message: "Both fields are required",
      });
  });

  test("Sould return error when email is invalid", async ()=> {
      req.body = {
          email: "invalidEmail",
          current_password: "password123",
      };

      await signIn(req, res);


      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
          message: "Invalid email format",
      });
  });

  test("Shoeld return error when user is not found", async ()=>{
      req.body = {
          email: "notfound@test.com",
          current_password: "password123",
      };

      mockFindUnique.mockResolvedValue(null);
      await signIn(req,res);
      expect(mockFindUnique).toHaveBeenCalledWith({
          where: {email: "notfound@test.com"},
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
          message: "User not found",
      });
  });

  test("Should returno error when password does'nt match", async()=>{
      req.body = {
          email: "test@test.com",
          current_password: "wrongpassword",
      };

      mockFindUnique.mockResolvedValue({
          id: 1,
          email: "test@test.com",
          current_password: "",
      })
  });

  test("Should sign in user successfully and return token", async () =>{
    
  });

  test("Should handle server error during sign in", async () => {
    req.body = {
      email: "test@test.com",
      current_password: "password123",
    };
    
    // Simulamos un error en la base de datos
    mockFindUnique.mockRejectedValue(new Error("Database error"));
    
    await signIn(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Login failed",
    });
  });



});