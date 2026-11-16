{
  description = "MINIX ER937-AI under NixOS: a reproducible load test and the configuration it was measured on";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, disko, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      # The test itself is loadtest.py; this only puts its tools on PATH.
      loadtest = pkgs.writeShellApplication {
        name = "loadtest";
        runtimeInputs = with pkgs; [
          python3
          stress-ng
          fio
          smartmontools
          util-linux
        ];
        text = ''exec python3 ${./loadtest.py} "$@"'';
      };
    in
    {
      packages.${system}.default = loadtest;
      apps.${system}.default = {
        type = "app";
        program = "${loadtest}/bin/loadtest";
      };

      # The example host. Fill in the three placeholders in nixos/ before installing.
      nixosConfigurations.er937 = nixpkgs.lib.nixosSystem {
        modules = [
          disko.nixosModules.disko
          ./nixos/configuration.nix
        ];
      };
    };
}
