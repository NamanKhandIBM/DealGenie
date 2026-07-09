# README

The IBM.com Search team has a search API wrapper that can be used with the standard [Langchain](https://github.com/hwchase17/langchain) [Agent](https://python.langchain.com/en/latest/modules/agents.html) to supplement LLM information retrieval with the vast content of the IBM.com web site content.

This is the recommended and supported way to consume the IBM.com content in your AI and LLM use cases at IBM.

The IBM.com Search wrapper is API compatible with the standard [Langchain Google SerperAPIWrapper](https://python.langchain.com/docs/integrations/providers/google_serper/).  This wrapper uses the IBM.com organic search results data for retrieval augmented generation use cases.


## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Similarity Searches](#performing-similarity-searches-from-keyword-search-results)
- [FAQ](#faq)
- [Support](#support)
- [Contributing](#contributing)

## Installation
There are two methods to install the search wrapper. You can use either Artifactory or GitHub. 

### Artifactory Install Method
If you are planning to install using Artifactory please request access to the Artifactory repo by making a request on the [#m-search Slack channel](https://ibm.enterprise.slack.com/archives/C5AENNYL9) and provide the build ids that you will be using to access the Artifactory repo.

Here is a quick summary of the steps. For detailed instructions, see [Private Dependencies for Cirrus CI/CD Pipelines](https://pages.github.ibm.com/cio-ci-cd/documentation/python-and-cirrus/#private-dependencies)

1. Obtain Artifactory token/password, see [JFrog](https://na.artifactory.swg-devops.com/ui/repos/tree/General). **Note! You will need to create a new token/password every 90 days.**
2. Create two environment variables **ART_USERNAME** and **ART_PASSWORD** and add them to your secrets in your CI/CD pipeline. Replace the values for the username and token with the values you obtained from JFrog.
```
ART_USERNAME=username@ibm.com
ART_PASSWORD=artifactory token value
```
3. Obtain a GitHub token, see [GitHub](https://github.ibm.com/settings/tokens)
4. Create a credentials string to access the **ibm_search_ai** artifactory repo. Replace **\${ARTIFACTORY_TOKEN}** with your Artifactory token/password. Replace **username@ibm.com** with your username. **Note! Don't replace the ART_USERAME and ART_PASSWORD with the actual values. These are simply the names of the variables that will be replaced dynamically when your CI/CD pipeline is run.** 
```
https://na.artifactory.swg-devops.com/artifactory/api/pypi/dbg-unified-search-pypi-local/simple;;ibm_search_ai;;username@.ibm.com;;${ARTIFACTORY_TOKEN};;ART_USERNAME;;ART_PASSWORD
```
5. Encrypt the credentials string by replacing the **\${YOUR_SECRET}** with the credentials string you just created. Also, replace the **\${GH_TOKEN}** with your GitHub token, **\${YOUR_GITHUB_ORG}**, and **\${YOUR_REPO}** with your org and repo.
```
curl -d "{\"githubAccessToken\":\"${GH_TOKEN}\",\"text\":\"${YOUR_SECRET}\"}" -H 'Content-Type: application/json' -X POST https://adopter-service-prod.dal1a.cirrus.ibm.com/v1/${YOUR_GITHUB_ORG}/${YOUR_REPO}/encrypt
```
6. Store the cipherText in the **private-dependencies** section of your **build.yml** file.
```
build:
  config:
    private-dependencies: encrypted:v1:AAABj...xxxx
```
6. Identify the release level of the search wrapper that you wish to install. The minimum version must be at least 0.1.69, see [Search Wrapper Releases](https://github.ibm.com/digital-marketplace/search-ai/releases).
7. Add the extra index and package name to your **requirements.txt** file. Note! don't replace the variable names with the actual values as these variables will be pulled from your secrets when you run your pipeline. **If you are testing your install locally, then define the ART_USERNAME and ART_PASSWORD in your local environment before you try to install.**
```
--extra-index-url=https://${ART_USERNAME}:${ART_PASSWORD}@na.artifactory.swg-devops.com/artifactory/api/pypi/dbg-unified-search-pypi-local/simple
ibm_search_ai==0.1.69
```
8. Import the search wrapper in your python script. If you have used the wrapper in the past the import has changed from ibm_search to **ibm_search_ai**.
```
import ibm_search_ai
```


### GitHub Install Method
To install the search wrapper you must specify the release that you wish to use in the pip install. For example, if you wanted to install release 0.1.71 then add **v.0.1.71** to the path in pip install command. See the releases section on Github to identify the latest release.

1. Identify the release level that you want to install.
<pre>
github.ibm.com/digital-marketplace/search-ai.git@<b>v0.1.71</b>#egg=ibm_search_ai&subdirectory=search_packages
</pre>
2. Add the package to your **requirements.txt** file or do a **pip install**.

If you are installing from **requirements.txt** then add this line:

```
ibm_search_ai@git+https://${GH_TOKEN}@github.ibm.com/digital-marketplace/search-ai.git@v0.1.71#egg=ibm_search_ai&subdirectory=search_packages
```
If you want to install from the command line using **pip**, then do the following:
```
git clone -b v0.1.71 https://${GH_TOKEN}@github.ibm.com/digital-marketplace/search-ai.git 
pip install ./search-ai/search_packages
```
3. Import the search wrapper in your python script. If you have used the wrapper in the past the import has changed from ibm_search to **ibm_search_ai**.
```
import ibm_search_ai
```
## Obtain your Search Wrapper API Token
Go to this IBM.com Search publisher [page](https://w3.ibm.com/w3publisher/search-and-discovery/adoption-integration/search-llm-wrapper-access-v3) to request your access token which will be used as `IBM_SEARCH_API_KEY` in the example usage below

## Usage

The plugin is used with [Langchain](https://github.com/hwchase17/langchain) as a tool as part of a [chain](https://api.python.langchain.com/en/latest/langchain/chains.html) workflow.

There is a sample "Hello World" minimalistic application that illustrates the usage of the tool in Langchain.  If needed, review and familiarize yourself with the Langchain concepts and the code pattern for the agent to better understand the example.

This example uses the [LangChain IBM Watsonx SDK](https://github.com/langchain-ai/langchain-ibm) API to run with [IBM WatsonX](https://www.ibm.com/watsonx) also.

Before starting, you need to have access to IBM watsonx in the form of an API Key, a Project Id, and also you need to get a API Key from the IBM.com Search team.

The following will explain the usage with Watsonx.

The two API Keys need to be exported along with the project id prior to running the application.
```
export WATSONX_PROJECT_ID=<PROJECT_ID>
export WATSONX_APIKEY=<API_KEY>
export IBM_SEARCH_API_KEY=<API_KEY>

```

This is the import section.
```
import os
import sys
import re
from typing import List, Optional
import ibm_search_ai
from langchain_ibm import WatsonxLLM
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda

```
Choose a model, such as Granite.
```
model_id = "ibm/granite-3-8b-instruct"

params = {
  "decoding_method": "greedy",
  "max_new_tokens": 700,
  "min_new_tokens": 1,
  "temperature": 0.12,
  "top_k": 5,
  "repetition_penalty": 1.05
}

watsonx = WatsonxLLM(
  model_id=model_id,
  url="https://us-south.ml.cloud.ibm.com",
  project_id=os.getenv("WATSONX_PROJECT_ID"),
  params=params
)

```
Get the question from command line or default to one for this example
```

question = ''
default_question = False

if not len(sys.argv) > 1:
    default_question = True
    # question = 'What are some tools that allows me to more accurately analyze complex relationships?'
    question = 'What is the default database name in db2'
else:
    question = sys.argv[1]

print(question)
```
Configure the watsonx Chain
Setup the chain with the IBM.com Wrapper
For more information on the options for `IBMSearchWrapper.set_search_scope()` see [scope definition](#scope_definition) table below
```
search_tool = ibm_search_ai.IBMSearchAPIWrapper(
    num_results = 20,
    result_len = 15000,
    result_type = 'body',
    search_scope = 'ibmdocs',
    # Retrieve the latest version of the document, excluding all outdated ones.  Defaults to True.
    # A value of True avoids repetitive almost identical content from coming up in retreieval when a new
    # version of a document already exists.  Useful for IBM Docs content where numerous versions and revisions
    # exist and are searachable in the corpus
    latest_version = True,
    # Add additional filters here in Lucene filter format surrounded by an outer parenthesis
    # eg.,
    # filter_metadata = '(dcc:SSEPGG AND dcc:HW28S)',
)

question_prompt_template = """
Agent: Okay, I am awaiting your instructions
User: Watson, here are your instructions:
1. You will be given a document that should be used to reply to user questions.
2. You should generate the next response using information available in the document.
3. If you can't find an answer, say 'I don't know'.
4. Your responses should include an answer and explanation.  Your responses should have about 2-5 sentences.
5. You should not repeat your answers.
6. Do not use any other sources of information.
User: Here's the document:
{context}
Agent: I am ready to answer your questions from the document. I will not repeat answers I have given.
User: {question}
Agent:
"""


results = search_tool.run(question)
context = results[:3800]
print('Using the following context: \n\n' + context + "\n\nEnd Context")

question_prompt = PromptTemplate(
    template=question_prompt_template, input_variables=["context", "question"]
)

# Embed the context into the no arg lambda function, and pass the original question through 
setup_and_retrieval = RunnableParallel(
    {"context": RunnableLambda(lambda _: context), "question": RunnablePassthrough()}
)

question_chain = (
    setup_and_retrieval 
    | question_prompt 
    | watsonx
    | StrOutputParser()
    | {"answer": answer})

try:
    answer = question_chain.invoke(query_string)['answer']
    print(f'The answer is: "{answer}"')
except Exception as e:
    raise GenerativeAIException("An error occured in watsonx try reducing the number of tokens in the prompt")

```

## Performing Similarity Searches from Keyword Search Results
With the IBM Search Wrapper you can perform a similiarity search on the content returned from keyword search results. The following example shows how to do this by using the `IBMSearchAPIWrapper.keyword_search`, `IBMSearchAPIWrapper.similarity_search`, and `IBMSearchAPIWrapper.similarity_search_with_score` class methods. These additional methods are an extension to the standard Langchain wrapper interface. Even though this is an extension to the standard wrapper functionality the return types are fully compatible with Langchain as these methods return Langchain Documents so the output can be easily integrated with other Langchain classes.

```
import ibm_search_ai
from langchain_community.embeddings.huggingface import HuggingFaceEmbeddings

# Load an embedding model that will be used in similarity searches 
local_embeddings = HuggingFaceEmbeddings(model_name = 'thenlper/gte-small')

query = 'What operating systems does instana support?'

# To extract the keywords from the query you can use watsonx.ai with a keyword extraction prompt.
# You could also use Python NLTK to help extract keywords from a search phrase.
keywords = 'instana support operating system'

# Use default 'all' search scope indicated by ''
# In this example we are limiting the size of the returned content from each search result 
# to be upto 15,000 characters.
# Call the search wrapper and perform a keyword search.
results = ibm_search_ai.IBMSearchAPIWrapper.keyword_search(search_scope='',
                                              refinement='ibmcom',
                                              country='us', 
                                              language='en', 
                                              query=keywords, 
                                              num_results=10, 
                                              result_len=15000,
                                              latest_version=True,
                                              filter_metadata = '')

# Call similarity search on the results from the keyword search
# In this example we chunk the documents into blocks of 2,000 characters with
# an overlap of 200 characters.
search_docs = ibm_search_ai.IBMSearchAPIWrapper.similarity_search(results=results, 
                                                        query=query, 
                                                        embeddings=local_embeddings,
                                                        chunk_size=2000, 
                                                        chunk_overlap=200,
                                                        k=10)

# search_docs is a list of Langchain documents and now you can extract the content blocks
# The content for each document is in the page_content attribute.
# Each document has the following metadata attributes and can be accesed like this.
# d.metadata['title'], d.metadata['description'], d.metadata['source']

# Some search scopes also provide digital content codes such as ibmdocs and can be accessed like this
# d.metadata['digital_content_codes']

# The cldocs scope provides the cloud docs content types and can be accessed like this
# d.metadata['dwcontenttypes']

# If you want to get the scores for each document then you can call the
# ibm_search_ai.IBMSearchAPIWrapper.similarity_search_with_score this method returns a 
# list of tuples where the first element is the langchain Document and the second 
# entry is the floating point score for the Document.

# Extract the content from each Document
snippets = [d.page_content for d in search_docs]

# You can take the content blocks and include them in your watsonx.ai prompt
content_blocks = '\n\n'.join(snippets)
```

### <a name="scope_definition"></a>Search Scope Definitions
Scopes are the major buckets that contain the different content types at IBM.com.  If the value is not explicitly set, the search is unscoped and will default to the all scope.

In practice we don't always want to search without a scope because though we get more results (higher recall), get flooded with results that will not all be relevant (lower precision).

If you know your target document type (eg, ibmdocs), then you can pass in the scope to filter it and improve your precision.

To get the list of supported search scopes you can call the search wrapper get_supported_scopes class method.
```
import ibm_search_ai

search_scopes = ibm_search_ai.IBMSearchScopes.get_supported_scopes()
```

| Scope value | Description |
|---|---|
| careers2 | IBM Careers |
| casestudies | IBM Case Studies |
| cldocs | IBM Cloud Docs |
| dblue | IBM Support Tech Notes |
| developers | IBM Developer information |
| downloads | Content such as fixes and eassemblies |
| dw | Content from IBM Developer |
| eassembly | Downloadable components and images from Passport Advantage Online |
| fixes | Downloadable fixes from IBM Fix Central |
| ibmdocs | Product documentation from IBM Docs |
| ibv | Institute for Business Value |
| jazz | jazz.net content |
| knownissues | Known Issues are replacements for IBM APARs (Authorized Program Analysis Report) |
| oix | Sales Knowledge Management / IBM Offering Information |
| ppd | PartnerPlus Directory |
| redbooks | Redbook descriptions only (use redbooks vector store for searching the contents of Redbooks) |
| research | IBM Research |
| sdk | SDK information |
| secbulletins | IBM Security bulletins |
| spe | IBM support site for IBM products and services |
| support | IBM Support |
| swlicensing | IBM Software Licensing & Compliance |
| terms | IBM Terms |
| training | Content from IBM Training |


## Accessing Page Content and Metadata from Search Results
The `IBMSearchAPIWrapper.keyword_search()` and `IBMSearchAPIWrapper.similarity_search()` both return lists of [Langchain Document](https://python.langchain.com/api_reference/core/documents/langchain_core.documents.base.Document.html). The contents for each document can be accessed by using the `page_content` attribute and the metadata can be accessed by using the `metadata` attribute. The available metadata is constantly being updated with new attributes. The following table lists the currently available fields. **Note! not all metadata fields will have values.** Some fields are only applicable to certain content types and search scopes. 

| Field Name | Type | Description |
|---|---|---|
| source | string | Page content URL |
| title | string | Title of page |
| description | string | Description of page |
| digital_content_codes | string array | dccs for IBM Docs and Support content |
| support_level_codes | string array | slcs for Support content |
| dwcontenttypes | string array | Cloud docs content codes |
| ts_categories | string array | Taxonomy code used by dblue, these are typically dcc codes |
| ts_document_types | string array | Support content type ID numbers |
| ts_software_versions | string array | Support software version numbers |
| arm_categories | string array | Asset reuse manager category ID numbers |
| keywords | string array | Search keywords |
| scopes | string array | Search scope for this content |
| semver_tags | string array | Semantic version tags |
| mtm_tags | string array | Machine type model numbers |
| alt_ver_tags | string array | Product specific alternate version tags |
| build_epoch | integer | Epoch date |
| url | string array | Page URL |
| suggested_match | boolean | Indicates if this is a curated link |
| keyword_search_score | float | Raw Elastic keyword score, note! suggested matches will have a score of -1 | 

## Accessing Internal Content
The `IBMSearchAPIWrapper.keyword_search()` supports access to internal content for some search scopes, e.g., ibmdocs. To access internal content your API Token must be authorized for access to internal content. If your token is authorzied then you may set the optional `internal_docs` parameter to True. See the following example.
```
import ibm_search_ai

results = ibm_search_ai.IBMSearchAPIWrapper.keyword_search(
                search_scope='ibmdocs',
                refinement='ibmcom',
                country='us', 
                language='en',
                query='db2', 
                num_results=15, 
                result_len=30000,
                internal_docs=True)

```

## Creating Search Filters
The IBM Search Wrapper provides the `IBMSearchFilter.construct_search_filter()` helper class method to construct filters that can be used in the search wrapper. **Note! not all filters are available in every search scope**. If a filter is not applicable in a search scope it is generally ignored. Filter values are case sensitive and are subject to frequent change so be sure to validate that the filter values are still valid and in use. All filter items must be an array of strings. Wildcards and regular expressions are not supported in filters. When using the the construct search filter method, multiple values for each filter type are grouped in a logical OR block. Multiple filter types are grouped in a logical AND block. See the example below.
```
import ibm_search_ai

supported_filters = ibm_search_ai.IBMSearchFilter.get_supported_filters()

print(supported_filters)

# ['dcc', 'digital_content_codes', 'dwcontenttypes', 'ts_document_types', 'ts_software_versions', 'arm_categories', 'keywords']

filters = [
    {'filter_type': 'digital_content_codes', 'items': ['SMSCA4SV', 'SSCA4SV']}, 
    {'filter_type': 'ts_document_types', 'items': ['DB550']}
]

filter_str = ibm_search_ai.IBMSearchFilter.construct_search_filter(filters)

print(filter_str)

# (dcc:SMSCA4SV OR dcc:SSCA4SV) AND (tsdoctypedrill:DB550)

# The filter can then be used in a keyword search

results = ibm_search_ai.IBMSearchAPIWrapper.keyword_search(
                search_scope='dblue',
                refinement='support',
                country='us', 
                language='en',
                query='db2', 
                num_results=15, 
                result_len=30000,
                latest_version=True,
                filter_metadata=filter_str)

```

#### Versioning, Build Number, and Machine Type Model Data Filtering
New filters and metadata elements have been introduced to help narrow down searches to specific product versions and hardware machine type model numbers. The primary filter used is the `semver_tag`, which allows you to scope your search by a specific version or a range of versions. **Note! When using the `semver_tag` filter it is recommended to set the `latest_version` API parameter to False**. Failure to set the `latest_version` to False will limit the `semver_tag` filter to only be applied to content that is tagged as `latest_version` equal to True.

In IBM content, a `semver_tag` is structured as a 4-tuple: **version.release.modification.fix**. Each component represents a part of the versioning system:

- **Version**: The major version number.
- **Release**: The minor release number.
- **Modification**: The modification level within the release.
- **Fix**: The specific fix applied.

Even if some components are unused, all four values are stored to maintain consistency across versions. This structure ensures that you can apply precise filters to your searches.

When using the `semver_tag` filter in queries, you have two options: **wildcards** and **literal values**.

- **Wildcards**: These allow for flexible searching. For example the following queries are all treated the same:
  - `1.x`: Expands to `1.x.x.x`, matching all versions from 1.0.0.0 up to, but not including, 2.0.0.0.
  - `1.*`: Expands to `1.x.x.x`, matching all versions from 1.0.0.0 up to, but not including, 2.0.0.0.
  - `1`: Expands to `1.x.x.x`, matching all versions from 1.0.0.0 up to, but not including, 2.0.0.0.

- **Literal Values**: These match exact version strings. For instance, specifying `1.0.0.0` will return content tagged precisely with that version.

It's important to note that when using wildcards in the filter, **missing values are padded with `x`**. This ensures that partial specifications like `1.2` are treated as `1.2.x.x`, broadening your search scope effectively.

For more refined control over version ranges, the `semver_tags_range` filter is available. Unlike the standard `semver_tag` filter, this one **requires both the lower and upper bounds to be complete version strings without wildcards**. This ensures precise range definitions.

In some cases, content may use **build numbers** to indicate versions. These build numbers are recorded as **Unix Epoch times in seconds**. To filter based on these build numbers, you can use the `build_epoch` and `build_epoch_range` filters.

To query for specific machine type model numbers the `mtm_tags` flter can be used to properly scope searches to content for specific hardware. When using the machine type model number filter the **value must not include any dashes or spaces**. Additionally, wildcards are not supported when using machine type model number filters.

In some cases teams may also use special tags for additional versioning information and these can be filtered using the `altver_tags` filter. When this filter is used excact matching rules will be applied.


| Filter Name | Description | Example |
|---|---|---|
| semver_tags | Semantic version number | {'filter_type': 'semver_tags', 'items': ['1.x']} finds all content between >= 1.0.0.0 and < 2.0.0.0 |
| semver_tags_range | Semantic version numbers range |  {'filter_type': 'semver_tags_range', 'items': ['1.0.0.0', '1.0.0.1']} finds content between the two values inclusive |
| mtm_tags | Machine type model numbers | {'filter_type': 'mtm_tags', 'items': ['9830AS1']} |
| altver_tags | Product specific version tags | {'filter_type': 'altver_tags', 'items': ['beta1']} |
| build_epoch | Build number Unix Epoch | {'filter_type': 'build_epoch', 'items': [1739302517]} |
| build_epoch_range | Build numbers range | {'filter_type': 'build_epoch_range', 'items': [1739302517,1739302575]} finds content between the two values inclusive|

## Searching for URL Data
The IBM Search Wrapper provides the `IBMSearchWrapper.url_search()` class method to obtain information on indexed urls. This class method returns a list of [Langchain Document](https://python.langchain.com/api_reference/core/documents/langchain_core.documents.base.Document.html) for each url. **Note! this class method is both rate limited and payload limited to prevent impact on production systems.** See the example below for how to use this method to obtain Elastic index information for one or more urls.
```
import ibm_search_ai

# docs is a list of LangChain Documents

url_list = [
    'https://cloud.ibm.com/docs/watsonxdata?topic=watsonxdata-db2_database',
    'https://cloud.ibm.com/catalog/services/db2'
]

docs = ibm_search_ai.IBMSearchAPIWrapper.url_search(url_list=url_list)

# Unpack all the metadata fields
doc_metadata_list = [doc.metadata for doc in docs]

# Unpack the bodies of each url
doc_content_list = [doc.page_content for doc in docs]
```

## CICD <a name="cicd"></a>
* The Search Wrapper is hosted on github enterprise internally.  To install in a CICD environment, the GH_TOKEN needs to be defined in the pipeline during the install step.

The Cirrus CICD pipeline documents how to add a custom registry setting for [Artifactory](https://pages.github.ibm.com/cio-ci-cd/documentation/python-and-cirrus/#private-dependencies) specifically, but it doesn't describe it in a generic way that can work for other module repos like packages hosted on Github, which is the case with this search wrapper.

The requirement is simple: Define the GH_TOKEN environment variable value with your valid Github token.

The key is to understand the step documented to add the Artifactory environment variable:
`curl -d "{\"githubAccessToken\":\"${YOUR_TOKEN}\",\"text\":\"${YOUR_SECRET}\"}" -H 'Content-Type: application/json' -X POST https://adopter-service-prod.dal1a.cirrus.ibm.com/v1/${YOUR_GITHUB_ORG}/${YOUR_REPO}/encrypt
`

For our case, we want to setup GH_TOKEN, so the curl would look like this instead:
`curl -d "{\"githubAccessToken\":\"<your github token value>",\"text\":\"dummy-url;;dummy-name;;<your_email@ibm.com>;;<your github token value>;;GITHUB_ENTERPRISE_USERNAME;;GH_TOKEN\"}" -H 'Content-Type: application/json' -X POST https://adopter-service-prod.dal1a.cirrus.ibm.com/v1/ibm-docs/milvus-search-api/encrypt`

This will generae an encrypted value that you can add to your build.yaml under the `config->private-dependencies` atribute.

A big thank you to the brilliant [Andrej Madjerka](andrej.maderka@sk.ibm.com) for coming up with this clever workaround.


## FAQ
* Who do I contact if I am having issues with the IBM LangChain Search Wrapper or search API?
    * Contact the Unified Search team on Slack #m-search slack channel: https://ibmtraining.slack.com/archives/C5AENNYL9
* Where can I get more information on how to perform searches using LangChain?
    * Explore the LangChain examples that show how other search wrappers can be used https://python.langchain.com/docs/integrations/tools/google_search
* Where can I find examples of how to perform retrieval augmented generation search?
    * Check out the solution gallery for RAG examples https://watsonx-ai-solution-gallery.wdc1a.ciocloud.nonprod.intranet.ibm.com/ 
* I want to deploy this on the CIO CICD Python Pipeline but I am getting an error in the `install` step trying to install this package which hosted github enterprise
    * You need to define the GH_TOKEN variable with your Github token value.  Follow the instructions [here](#cicd).

## Support

Please post a comment in our [Slack channel](https://ibmtraining.slack.com/archives/C5AENNYL9) for support.

## Contributing

Please contribute using [Github Flow](https://guides.github.com/introduction/flow/). Create a branch, add commits, and [open a pull request](https://github.ibm.com/digital-marketplace/search-ai/compare/).
