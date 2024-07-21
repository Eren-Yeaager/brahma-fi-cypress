const { ethers } = require("ethers");
const config = require("../config");

const provider = new ethers.JsonRpcProvider(config.providerUrl);
const wallet = new ethers.Wallet(config.privateKey, provider);

const injectCustomProvider = () => {
  cy.window().then((win) => {
    win.ethereum = {
      isMetaMask: true,
      selectedAddress: wallet.address,
      enable: () => Promise.resolve([wallet.address]),
      request: ({ method, params }) => {
        switch (method) {
          case "eth_requestAccounts":
            return Promise.resolve([wallet.address]);
          case "eth_accounts":
            return Promise.resolve([wallet.address]);
          case "eth_chainId":
            return Promise.resolve("0xa4b1");
          case "eth_signTypedData_v4":
            const [address, typedData] = params;
            return wallet
              ._signTypedData(
                typedData.domain,
                typedData.types,
                typedData.message
              )
              .then((signature) => signature);
          default:
            return provider.send(method, params);
        }
      },
    };
  });
};

const postToArbitrum = (url) => {
  return cy.request({
    method: "POST",
    url: url,
    body: {},
    failOnStatusCode: false,
  });
};

describe("Navigate to Dashboard", () => {
  it("Connects wallet and signs a message and navigates to the dashboard", () => {
    // Load the Brahma console
    cy.visit("https://console.brahma.fi");

    // Inject the custom provider
    injectCustomProvider();

    // Wait for the wallet provider to be injected
    cy.window().should("have.property", "ethereum");
    cy.log("Ethereum provider injected");

    // Click on 'Connect Wallet' and select the wallet option
    cy.contains("Connect Wallet").should("be.visible").click();
    cy.contains("Browser Wallet").should("be.visible").click();
    cy.wait(4000);

    // Intercept the specific request
    for (let i = 0; i < 3; i++) {
      postToArbitrum(config.postUrl).then((response) => {
        expect(response.status).to.equal(200);
        cy.contains("RETRY").click();
        cy.log(
          `POST request ${i + 1} completed with status ${response.status}`
        );
      });
    }
    cy.wait(1000);
    cy.window().then((win) => {
      win.localStorage.setItem(
        "brah_acc_auth-0xc7aD8a29EdA1844C6Eab6102F421EDe9159b5AA4",
        JSON.stringify({
          accessToken: config.accessToken,
          expiresAt: 1721558635,
          redirect: false,
          refreshToken: config.refreshToken,
        })
      );
      cy.log("LocalStorage item set");
    });
    cy.wait(5000);
    cy.contains("UI-Testing").click({ force: true });
    cy.wait(5000);
    cy.get("[type=TITLE_XL]").should("be.visible");
    cy.get("[type=TITLE_XL]").should("contain.text", "$0.00");
    cy.screenshot('assertion-screenshot');
  });
});
