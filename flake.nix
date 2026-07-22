{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs?ref=unstable";
    utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, utils }: utils.lib.eachDefaultSystem (system:
    let
      pkgs = nixpkgs.legacyPackages.${system};
      common = with pkgs; [ git ];
    in
    {
      devShell = {
        default = pkgs.mkShell {
          buildInputs = common ++ (with pkgs; [
            nodejs_24
            typescript-language-server
          ]);
        };
      };
    }
  );
}
