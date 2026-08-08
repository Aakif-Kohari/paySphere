describe("User Authentication E2E Tests", () => {
  const timestamp = Date.now();
  const testEmail = `testuser_${timestamp}@example.com`;
  const testPassword = "SecurePassword123!";
  const testName = "Test User";

  it("should successfully sign up a new user", () => {
    cy.visit("/auth?mode=signup");
    cy.get('input[name="fullName"], input#fullName').type(testName);
    cy.get('input[name="email"], input#email').type(testEmail);
    cy.get('input[name="password"], input#password').type(testPassword);
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/dashboard");
  });

  it("should handle incorrect password on login", () => {
    cy.visit("/auth?mode=login");
    cy.get('input[name="email"], input#email').type(testEmail);
    cy.get('input[name="password"], input#password').type("WrongPassword!");
    cy.get('button[type="submit"]').click();
    cy.contains(/invalid|error|incorrect/i).should("be.visible");
  });

  it("should log in and log out successfully", () => {
    cy.visit("/auth?mode=login");
    cy.get('input[name="email"], input#email').type(testEmail);
    cy.get('input[name="password"], input#password').type(testPassword);
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/dashboard");

    // Perform logout
    cy.get('button, a').contains(/logout|sign out/i).click();
    cy.url().should("include", "/auth");
  });
});