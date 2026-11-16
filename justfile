# Run `just` to list recipes.
default:
    @just --list

# A five-minute smoke run of the load test (needs root).
quick:
    sudo nix run . -- --quick

# The full load test, about 100 minutes (needs root).
full:
    sudo nix run .

# Work on the results page locally.
site-dev:
    cd site && npm install && npm run dev

# Build the results page the way GitHub Actions does.
site-build:
    cd site && npm ci && npm run build

# Check that the flake, the load test wrapper and the example host all evaluate and build.
check:
    nix build .#default --no-link
    nix eval --raw .#nixosConfigurations.er937.config.system.build.toplevel.drvPath
