import yaml

VERSION_TEMPLATE = f"""
    <div class="version">Version #VERSION#</div>
        #FEATURES#
"""

FEATURE_TEMPLATE = f"""
        <div class="feature">
            <div class="feature-title">#TITLE#</div>
            <div class="feature-description">
                #DESCRIPTION#
            </div>
        </div>
"""

result = []

with open("versions.yaml", "r") as vfile:
    versions_file = yaml.safe_load(vfile)

    prepared_features = "".join(list(map(
        lambda version: VERSION_TEMPLATE
        .replace('#VERSION#', str(version['version']))
        .replace(
            '#FEATURES#',
            "".join(list(map(
                lambda feature: FEATURE_TEMPLATE
                .replace('#TITLE#', feature['title'])
                .replace('#DESCRIPTION#', feature['description'].strip())
                , version['features']
            ))).strip()
        )
        , versions_file
    )))

with open("update-template.html", "r") as ufile:
    prepared_template = "".join(ufile.readlines()).replace("#CONTENT#", prepared_features)

with open("../html/update.html", "w") as wfile:
    wfile.writelines(prepared_template)
